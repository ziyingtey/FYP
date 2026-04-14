using bds_backend.Data;
using bds_backend.Dtos;
using bds_backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace bds_backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RoutesController(
    AppDbContext db,
    GoogleRoutesService googleRoutesService) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("compute")]
    public async Task<ActionResult<RouteSummaryDto>> Compute([FromBody] ComputeRouteRequest request, CancellationToken ct)
    {
        if (!double.IsFinite(request.UserLat) || !double.IsFinite(request.UserLng))
        {
            return BadRequest(new { message = "Valid user coordinates are required." });
        }

        var branch = await db.Branches.AsNoTracking()
            .FirstOrDefaultAsync(
                b => b.Id == request.BranchId && b.Latitude != null && b.Longitude != null,
                ct);

        if (branch is null)
        {
            return NotFound(new { message = "Branch with coordinates not found." });
        }

        var result = await googleRoutesService.ComputeRouteAsync(branch, request.UserLat, request.UserLng, ct);
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpPost("nearest")]
    public async Task<ActionResult<RouteSummaryDto>> Nearest([FromBody] ComputeRouteRequest request, CancellationToken ct)
    {
        if (!double.IsFinite(request.UserLat) || !double.IsFinite(request.UserLng))
        {
            return BadRequest(new { message = "Valid user coordinates are required." });
        }

        var branches = await db.Branches.AsNoTracking()
            .Where(b => b.Latitude != null && b.Longitude != null && !string.IsNullOrWhiteSpace(b.State))
            .ToListAsync(ct);

        if (branches.Count == 0)
        {
            return NotFound(new { message = "No geocoded branches available." });
        }

        var shortlist = branches
            .OrderBy(b => Geo.GeoDistance.HaversineKm(request.UserLat, request.UserLng, b.Latitude!.Value, b.Longitude!.Value))
            .Take(5)
            .ToList();

        RouteSummaryDto? best = null;
        foreach (var branch in shortlist)
        {
            var route = await googleRoutesService.ComputeRouteAsync(branch, request.UserLat, request.UserLng, ct);
            var candidateScore = route.RoadDistanceKm ?? route.StraightLineKm;
            var bestScore = best is null ? double.MaxValue : best.RoadDistanceKm ?? best.StraightLineKm;
            if (candidateScore < bestScore)
            {
                best = route;
            }
        }

        return best is null ? NotFound() : Ok(best);
    }
}
