using bds_backend.Data;
using bds_backend.Dtos;
using bds_backend.Geo;
using bds_backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace bds_backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BranchesController(
    AppDbContext db,
    WaitPredictionService waitPrediction) : ControllerBase
{
    /// <summary>List branches with server-side wait estimates (0 min when nobody is waiting).</summary>
    /// <param name="state">Optional: filter by Malaysian state label (same wording as official PBE branch locator).</param>
    /// <param name="userLat">Optional: user latitude for live distanceKm (Haversine) when branch has coordinates.</param>
    /// <param name="userLng">Optional: user longitude for live distanceKm.</param>
    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<BranchListItemDto>>> List(
        [FromQuery] string? state,
        [FromQuery] double? userLat,
        [FromQuery] double? userLng,
        CancellationToken ct)
    {
        var q = db.Branches.AsNoTracking()
            .Where(b => !string.IsNullOrWhiteSpace(b.State)
                        && b.Latitude != null
                        && b.Longitude != null)
            .AsQueryable();
        if (!string.IsNullOrWhiteSpace(state))
        {
            var norm = state.Trim();
            q = q.Where(b => b.State == norm);
        }

        var branches = await q.OrderBy(b => b.State).ThenBy(b => b.Name).ToListAsync(ct);
        var now = DateTime.UtcNow;
        var list = new List<BranchListItemDto>();

        var haveUser = userLat is not null && userLng is not null
                       && double.IsFinite(userLat.Value) && double.IsFinite(userLng.Value);

        foreach (var b in branches)
        {
            var slots = await db.BranchTimeSlots.AsNoTracking()
                .Where(s => s.BranchId == b.Id)
                .ToListAsync(ct);
            var hasAvailable = slots.Count == 0 || slots.Any(s => s.BookedCount < s.Capacity);
            var overcrowded = string.Equals(b.CrowdLevel, "High", StringComparison.OrdinalIgnoreCase);
            var canBook = !b.BookingDisabled && hasAvailable && !overcrowded;

            var predict = await waitPrediction.PredictAsync(new PredictWaitRequest
            {
                BranchId = b.Id,
                DayOfWeek = (int)now.DayOfWeek,
                HourOfDay = now.Hour,
                Month = now.Month,
                ServiceType = "GeneralBanking",
                QueueLength = b.WaitingCount,
                CountersOpen = 4,
            }, ct);

            var distanceKm = b.DistanceKm;
            if (haveUser && b.Latitude is not null && b.Longitude is not null)
            {
                distanceKm = GeoDistance.HaversineKm(
                    userLat!.Value, userLng!.Value,
                    b.Latitude.Value, b.Longitude.Value);
            }

            list.Add(new BranchListItemDto
            {
                Id = b.Id,
                Name = b.Name,
                State = b.State,
                Address = b.Address,
                Phone = b.Phone,
                PlaceId = b.PlaceId,
                Latitude = b.Latitude,
                Longitude = b.Longitude,
                DistanceKm = distanceKm,
                CrowdLevel = b.CrowdLevel,
                SlotCapacity = b.SlotCapacity,
                SlotBooked = b.SlotBooked,
                WaitingCount = b.WaitingCount,
                BookingDisabled = b.BookingDisabled,
                HasAvailableSlot = hasAvailable,
                IsOvercrowded = overcrowded,
                CanBook = canBook,
                EstimatedWaitMinutes = predict.WaitMinutes,
                EstimateSource = predict.Source,
            });
        }

        return Ok(list);
    }

    /// <summary>Time slots with live capacity (Module 2).</summary>
    [AllowAnonymous]
    [HttpGet("{id:int}/slots")]
    public async Task<ActionResult<IReadOnlyList<BranchTimeSlotDto>>> Slots(int id, CancellationToken ct)
    {
        var exists = await db.Branches.AsNoTracking().AnyAsync(b => b.Id == id, ct);
        if (!exists) return NotFound();

        var rows = await db.BranchTimeSlots.AsNoTracking()
            .Where(s => s.BranchId == id)
            .OrderBy(s => s.Id)
            .Select(s => new BranchTimeSlotDto
            {
                Label = s.Label,
                Capacity = s.Capacity,
                Booked = s.BookedCount,
            })
            .ToListAsync(ct);

        return Ok(rows);
    }

    /// <summary>Demo: advance the serving counter (staff / test). Decrements waiting count.</summary>
    [AllowAnonymous]
    [HttpPost("{id:int}/call-next")]
    public async Task<IActionResult> CallNext(int id, CancellationToken ct)
    {
        var branch = await db.Branches.FirstOrDefaultAsync(b => b.Id == id, ct);
        if (branch is null) return NotFound();

        if (branch.WaitingCount > 0)
        {
            branch.NowServingNumber++;
            branch.WaitingCount--;
        }
        else
        {
            branch.NowServingNumber++;
        }

        await db.SaveChangesAsync(ct);
        return Ok(new { branch.NowServingNumber, branch.WaitingCount });
    }
}
