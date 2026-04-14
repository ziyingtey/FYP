using System.Text.Json;
using bds_backend.Data;
using bds_backend.Models;
using bds_backend.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace bds_backend.Services;

public sealed class BranchDirectorySyncService(
    IOptions<BranchDirectoryOptions> options,
    IWebHostEnvironment env,
    ILogger<BranchDirectorySyncService> logger)
{
    private static readonly string[] DefaultSlotLabels =
    [
        "09:00 - 09:30",
        "09:30 - 10:00",
        "10:00 - 10:30",
        "10:30 - 11:00",
        "11:00 - 11:30",
    ];

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public async Task<int> SyncFromFileIfPresentAsync(AppDbContext db, CancellationToken ct = default)
    {
        var configuredPath = options.Value.ImportPath?.Trim();
        if (string.IsNullOrWhiteSpace(configuredPath))
        {
            return 0;
        }

        var fullPath = Path.IsPathRooted(configuredPath)
            ? configuredPath
            : Path.Combine(env.ContentRootPath, configuredPath);

        if (!File.Exists(fullPath))
        {
            logger.LogInformation("Branch directory import file not found at {Path}. Skipping sync.", fullPath);
            return 0;
        }

        await using var stream = File.OpenRead(fullPath);
        var rows = await JsonSerializer.DeserializeAsync<List<BranchDirectoryRow>>(stream, JsonOptions, ct)
                   ?? [];

        if (rows.Count == 0)
        {
            logger.LogWarning("Branch directory file {Path} exists but contained no rows.", fullPath);
            return 0;
        }

        var importedNames = rows
            .Where(IsValidRow)
            .Select(row => row.Name.Trim())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var byName = await db.Branches.ToDictionaryAsync(
            branch => branch.Name,
            StringComparer.OrdinalIgnoreCase,
            ct);

        var changed = 0;
        foreach (var row in rows.Where(IsValidRow))
        {
            if (!byName.TryGetValue(row.Name.Trim(), out var branch))
            {
                branch = new Branch
                {
                    Name = row.Name.Trim(),
                    CrowdLevel = "Low",
                    SlotCapacity = 8,
                    SlotBooked = 0,
                    WaitingCount = 0,
                    NowServingNumber = 0,
                    LastIssuedNumber = 0,
                    BookingDisabled = false,
                    DistanceKm = 0
                };
                db.Branches.Add(branch);
                byName[branch.Name] = branch;
            }

            branch.State = row.State.Trim();
            branch.Address = Clean(row.Address);
            branch.Phone = Clean(row.Phone);
            branch.PlaceId = Clean(row.PlaceId);
            branch.Latitude = row.Latitude;
            branch.Longitude = row.Longitude;
            EnsureDefaultTimeSlots(db, branch);
            changed++;
        }

        foreach (var branch in byName.Values.Where(branch => !importedNames.Contains(branch.Name)))
        {
            branch.State = string.Empty;
            branch.Address = null;
            branch.Phone = null;
            branch.PlaceId = null;
            branch.Latitude = null;
            branch.Longitude = null;
            branch.BookingDisabled = true;
        }

        if (db.ChangeTracker.HasChanges())
        {
            await db.SaveChangesAsync(ct);
        }

        logger.LogInformation("Branch directory sync applied {Count} row(s) from {Path}.", changed, fullPath);
        return changed;
    }

    private static bool IsValidRow(BranchDirectoryRow row) =>
        !string.IsNullOrWhiteSpace(row.Name) &&
        !string.IsNullOrWhiteSpace(row.State) &&
        row.Latitude is not null &&
        row.Longitude is not null;

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static void EnsureDefaultTimeSlots(AppDbContext db, Branch branch)
    {
        if (branch.Id != 0 && db.BranchTimeSlots.Any(slot => slot.BranchId == branch.Id))
        {
            return;
        }

        var existingLabels = branch.Id == 0
            ? new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            : db.BranchTimeSlots
                .Where(slot => slot.BranchId == branch.Id)
                .Select(slot => slot.Label)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var label in DefaultSlotLabels.Where(label => !existingLabels.Contains(label)))
        {
            db.BranchTimeSlots.Add(new BranchTimeSlot
            {
                Branch = branch,
                Label = label,
                Capacity = 8,
                BookedCount = 0,
            });
        }
    }

    private sealed class BranchDirectoryRow
    {
        public string Name { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string? Address { get; set; }
        public string? Phone { get; set; }
        public string? PlaceId { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
    }
}
