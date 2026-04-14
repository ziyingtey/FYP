namespace bds_backend.Dtos;

public class BranchListItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public string? PlaceId { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double DistanceKm { get; set; }
    public string CrowdLevel { get; set; } = "Low";
    public int SlotCapacity { get; set; }
    public int SlotBooked { get; set; }
    public int WaitingCount { get; set; }
    public bool BookingDisabled { get; set; }
    public bool HasAvailableSlot { get; set; }
    public bool IsOvercrowded { get; set; }
    public bool CanBook { get; set; }
    public double EstimatedWaitMinutes { get; set; }
    public string EstimateSource { get; set; } = "logic";
}

public class BranchTimeSlotDto
{
    public string Label { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public int Booked { get; set; }
}

public class CreateBookingRequest
{
    public int BranchId { get; set; }
    public string ServiceType { get; set; } = string.Empty;
    public string TimeSlotLabel { get; set; } = string.Empty;
}

public class CreateBookingResponse
{
    public int TicketId { get; set; }
    public int BranchId { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public string ServiceType { get; set; } = string.Empty;
    public string TimeSlotLabel { get; set; } = string.Empty;
    public string QueueLabel { get; set; } = string.Empty;
    public int QueueNumber { get; set; }
}

public class TicketStatusDto
{
    public int TicketId { get; set; }
    public int BranchId { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public string ServiceType { get; set; } = string.Empty;
    public string TimeSlotLabel { get; set; } = string.Empty;
    public string QueueLabel { get; set; } = string.Empty;
    public int QueueNumber { get; set; }
    public int NowServingNumber { get; set; }
    public string NowServingLabel { get; set; } = string.Empty;
    public int CustomersAhead { get; set; }
    public double EstimatedWaitMinutes { get; set; }
    public string EstimateSource { get; set; } = string.Empty;
    public string Status { get; set; } = "Waiting";
}
