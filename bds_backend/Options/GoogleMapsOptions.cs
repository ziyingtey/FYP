namespace bds_backend.Options;

public class GoogleMapsOptions
{
    public const string SectionName = "GoogleMaps";

    public string? ApiKey { get; set; }
    public string RoutesBaseUrl { get; set; } = "https://routes.googleapis.com";
}
