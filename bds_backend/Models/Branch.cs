namespace bds_backend.Models;

/// <summary>
/// Physical branch + operational queue snapshot (Module 1–3).
/// </summary>
public class Branch
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    /// <summary>Malaysian state / territory (same labels as official branch locator filters).</summary>
    public string State { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public string? PlaceId { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double DistanceKm { get; set; }
    /// <summary>Low | Moderate | High</summary>
    public string CrowdLevel { get; set; } = "Low";

    public int SlotCapacity { get; set; } = 8;
    public int SlotBooked { get; set; }

    /// <summary>Customers currently waiting (not yet called). If 0 → estimated wait 0.</summary>
    public int WaitingCount { get; set; }

    /// <summary>Queue number currently at counter (integer part).</summary>
    public int NowServingNumber { get; set; }

    /// <summary>Last issued queue number (monotonic).</summary>
    public int LastIssuedNumber { get; set; }

    public bool BookingDisabled { get; set; }
}
