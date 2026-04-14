using bds_backend.Models;
using Microsoft.EntityFrameworkCore;

namespace bds_backend.Data;

/// <summary>
/// Demo branch directory. For production / FYP realism, replace rows using coordinates and addresses
/// from the official Public Bank branch locator (manual export), not by scraping.
/// </summary>
public static class DbSeed
{
    private static readonly string[] SlotLabels =
    [
        "09:00 - 09:30",
        "09:30 - 10:00",
        "10:00 - 10:30",
        "10:30 - 11:00",
        "11:00 - 11:30",
    ];

    private static IReadOnlyList<DemoBranchSpec> AllSpecs =>
    [
        new(
            "BDS KL Sentral", "Kuala Lumpur",
            "KL Sentral (demo — replace from official PBE branch data)", "03-0000 0001",
            1.2, "Low", 8, 5, 3, 101, 104, false, 3.1344, 101.6862),
        new(
            "BDS Mid Valley", "Kuala Lumpur",
            "Mid Valley City (demo)", "03-0000 0002",
            2.3, "High", 8, 8, 12, 200, 212, true, 3.1187, 101.6765),
        new(
            "BDS Bangsar", "Kuala Lumpur",
            "Bangsar (demo)", "03-0000 0003",
            3.1, "Moderate", 8, 8, 6, 50, 56, false, 3.1291, 101.6711),
        new(
            "BDS Damansara", "Selangor",
            "Damansara (demo)", "03-0000 0004",
            5.4, "Low", 10, 4, 0, 300, 300, false, 3.1466, 101.6292),
        new(
            "BDS Johor Bahru", "Johor",
            "Johor Bahru city (demo)", "07-0000 0001",
            4.1, "Moderate", 8, 6, 5, 10, 15, false, 1.4927, 103.7414),
        new(
            "BDS Pasir Gudang", "Johor",
            "Pasir Gudang (demo)", "07-0000 0002",
            6.2, "Low", 8, 3, 2, 20, 22, false, 1.4721, 103.899),
        new(
            "BDS Permas Jaya", "Johor",
            "Permas Jaya (demo)", "07-0000 0003",
            5.8, "Low", 8, 4, 1, 30, 31, false, 1.4918, 103.8156),
        new(
            "BDS Labis", "Johor",
            "Labis, Segamat district (demo)", "07-0000 0004",
            12.0, "Low", 8, 2, 0, 1, 1, false, 2.3850, 102.5770),
        new(
            "BDS George Town", "Pulau Pinang",
            "George Town (demo)", "04-0000 0001",
            8.0, "Low", 8, 5, 4, 40, 44, false, 5.4141, 100.3288),
        new(
            "BDS Ipoh", "Perak",
            "Ipoh (demo)", "05-0000 0001",
            9.5, "Moderate", 8, 7, 3, 60, 63, false, 4.5975, 101.0901),
        new(
            "BDS Seremban", "Negeri Sembilan",
            "Seremban (demo)", "06-0000 0001",
            7.2, "Low", 8, 4, 2, 70, 72, false, 2.7258, 101.9423),
        new(
            "BDS Melaka", "Melaka",
            "Bandar Melaka (demo)", "06-0000 0002",
            10.1, "Low", 8, 3, 1, 80, 81, false, 2.1896, 102.2501),
        new(
            "BDS Kota Kinabalu", "Sabah",
            "Kota Kinabalu (demo)", "088-000 0001",
            14.0, "Low", 8, 2, 0, 90, 90, false, 5.9804, 116.0735),
        new(
            "BDS Kuching", "Sarawak",
            "Kuching (demo)", "082-000 0001",
            16.0, "Low", 8, 3, 2, 100, 102, false, 1.5535, 110.3593),
        new(
            "BDS Putrajaya", "Putrajaya",
            "Precinct 2 (demo)", "03-0000 0005",
            11.0, "Low", 8, 2, 0, 110, 110, false, 2.9264, 101.6964),
    ];

    public static void SeedBranches(AppDbContext db)
    {
        if (db.Branches.Any()) return;

        foreach (var spec in AllSpecs)
            db.Branches.Add(spec.ToBranch());

        db.SaveChanges();

        foreach (var b in db.Branches.OrderBy(x => x.Id).ToList())
            AddTimeSlots(db, b.Id, bookedPatternForNewBranch(b.Id));

        db.SaveChanges();
    }

    /// <summary>Adds any demo branches missing from an older database (e.g. only KL rows).</summary>
    public static void SeedBranchDirectoryExpansion(AppDbContext db)
    {
        var existing = db.Branches.Select(b => b.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var missing = AllSpecs.Where(s => !existing.Contains(s.Name)).ToList();
        if (missing.Count == 0) return;

        foreach (var spec in missing)
            db.Branches.Add(spec.ToBranch());

        db.SaveChanges();

        foreach (var spec in missing)
        {
            var row = db.Branches.AsNoTracking().First(b => b.Name == spec.Name);
            AddTimeSlots(db, row.Id, bookedPatternForNewBranch(row.Id));
        }

        db.SaveChanges();
    }

    private static int[] bookedPatternForNewBranch(int id) =>
        (id % 4) switch
        {
            1 => [8, 5, 7, 3, 8],
            2 => [8, 8, 8, 8, 8],
            3 => [8, 8, 8, 8, 8],
            _ => [4, 3, 2, 1, 0],
        };

    private static void AddTimeSlots(AppDbContext db, int branchId, int[] bookedPattern)
    {
        for (var i = 0; i < SlotLabels.Length; i++)
        {
            db.BranchTimeSlots.Add(new BranchTimeSlot
            {
                BranchId = branchId,
                Label = SlotLabels[i],
                Capacity = 8,
                BookedCount = bookedPattern[Math.Min(i, bookedPattern.Length - 1)],
            });
        }
    }

    private sealed record DemoBranchSpec(
        string Name,
        string State,
        string Address,
        string Phone,
        double DistanceKm,
        string CrowdLevel,
        int SlotCapacity,
        int SlotBooked,
        int WaitingCount,
        int NowServingNumber,
        int LastIssuedNumber,
        bool BookingDisabled,
        double Latitude,
        double Longitude)
    {
        public Branch ToBranch() => new()
        {
            Name = Name,
            State = State,
            Address = Address,
            Phone = Phone,
            Latitude = Latitude,
            Longitude = Longitude,
            DistanceKm = DistanceKm,
            CrowdLevel = CrowdLevel,
            SlotCapacity = SlotCapacity,
            SlotBooked = SlotBooked,
            WaitingCount = WaitingCount,
            NowServingNumber = NowServingNumber,
            LastIssuedNumber = LastIssuedNumber,
            BookingDisabled = BookingDisabled,
        };
    }
}
