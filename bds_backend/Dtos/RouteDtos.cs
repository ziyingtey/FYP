namespace bds_backend.Dtos;

public class ComputeRouteRequest
{
    public int BranchId { get; set; }
    public double UserLat { get; set; }
    public double UserLng { get; set; }
}

public class RouteSummaryDto
{
    public int BranchId { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public double StraightLineKm { get; set; }
    public double? RoadDistanceKm { get; set; }
    public double? RoadDurationMinutes { get; set; }
    public bool UsedGoogleRoutes { get; set; }
    public string Source { get; set; } = "haversine";
    public string? GoogleMapsUrl { get; set; }
}
