using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using bds_backend.Dtos;
using bds_backend.Geo;
using bds_backend.Models;
using bds_backend.Options;
using Microsoft.Extensions.Options;

namespace bds_backend.Services;

public sealed class GoogleRoutesService(
    IHttpClientFactory httpClientFactory,
    IOptions<GoogleMapsOptions> options,
    ILogger<GoogleRoutesService> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public async Task<RouteSummaryDto> ComputeRouteAsync(
        Branch branch,
        double userLat,
        double userLng,
        CancellationToken ct = default)
    {
        var straightLineKm = GeoDistance.HaversineKm(userLat, userLng, branch.Latitude!.Value, branch.Longitude!.Value);
        var mapsUrl =
            $"https://www.google.com/maps/dir/?api=1&origin={userLat},{userLng}&destination={branch.Latitude.Value},{branch.Longitude.Value}&travelmode=driving";

        var result = new RouteSummaryDto
        {
            BranchId = branch.Id,
            BranchName = branch.Name,
            StraightLineKm = straightLineKm,
            GoogleMapsUrl = mapsUrl,
            UsedGoogleRoutes = false,
            Source = "haversine"
        };

        if (string.IsNullOrWhiteSpace(options.Value.ApiKey))
        {
            return result;
        }

        try
        {
            var client = httpClientFactory.CreateClient("GoogleRoutes");
            client.BaseAddress = new Uri(options.Value.RoutesBaseUrl);
            client.DefaultRequestHeaders.Clear();
            client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            client.DefaultRequestHeaders.Add("X-Goog-Api-Key", options.Value.ApiKey);
            client.DefaultRequestHeaders.Add("X-Goog-FieldMask", "routes.distanceMeters,routes.duration");

            var destination = !string.IsNullOrWhiteSpace(branch.PlaceId)
                ? new Dictionary<string, object?>
                {
                    ["placeId"] = branch.PlaceId
                }
                : new Dictionary<string, object?>
                {
                    ["location"] = new
                    {
                        latLng = new { latitude = branch.Latitude.Value, longitude = branch.Longitude.Value }
                    }
                };

            var payload = new
            {
                origin = new
                {
                    location = new
                    {
                        latLng = new { latitude = userLat, longitude = userLng }
                    }
                },
                destination,
                travelMode = "DRIVE",
                routingPreference = "TRAFFIC_AWARE",
                units = "METRIC"
            };

            using var response = await client.PostAsync(
                "/directions/v2:computeRoutes",
                new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"),
                ct);

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                logger.LogWarning("Google Routes API failed with status {Status}: {Body}", response.StatusCode, body);
                return result;
            }

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            var parsed = await JsonSerializer.DeserializeAsync<ComputeRoutesResponse>(stream, JsonOptions, ct);
            var route = parsed?.Routes?.FirstOrDefault();
            if (route is null)
            {
                return result;
            }

            result.RoadDistanceKm = route.DistanceMeters / 1000.0;
            result.RoadDurationMinutes = ParseGoogleDurationToMinutes(route.Duration);
            result.UsedGoogleRoutes = result.RoadDistanceKm is not null || result.RoadDurationMinutes is not null;
            result.Source = result.UsedGoogleRoutes ? "google-routes" : result.Source;
            return result;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Google Routes lookup failed for branch {BranchId}. Falling back to Haversine.", branch.Id);
            return result;
        }
    }

    private static double? ParseGoogleDurationToMinutes(string? duration)
    {
        if (string.IsNullOrWhiteSpace(duration))
        {
            return null;
        }

        if (!duration.EndsWith('s'))
        {
            return null;
        }

        return double.TryParse(duration[..^1], out var seconds)
            ? seconds / 60.0
            : null;
    }

    private sealed class ComputeRoutesResponse
    {
        public List<RouteItem>? Routes { get; set; }
    }

    private sealed class RouteItem
    {
        public double DistanceMeters { get; set; }
        public string? Duration { get; set; }
    }
}
