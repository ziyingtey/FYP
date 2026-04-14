using Microsoft.EntityFrameworkCore;

namespace bds_backend.Data;

/// <summary>
/// <see cref="DatabaseFacade.EnsureCreated"/> does not add tables when the database already exists
/// (e.g. created before Branch/Queue entities). This applies the missing schema idempotently.
/// </summary>
public static class EnsureBranchQueueSchema
{
    public static void ApplyIfNeeded(AppDbContext db)
    {
        db.Database.ExecuteSqlRaw("""
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'Branches')
            BEGIN
                CREATE TABLE [Branches] (
                    [Id] int NOT NULL IDENTITY,
                    [Name] nvarchar(max) NOT NULL,
                    [DistanceKm] float NOT NULL,
                    [CrowdLevel] nvarchar(max) NOT NULL,
                    [SlotCapacity] int NOT NULL,
                    [SlotBooked] int NOT NULL,
                    [WaitingCount] int NOT NULL,
                    [NowServingNumber] int NOT NULL,
                    [LastIssuedNumber] int NOT NULL,
                    [BookingDisabled] bit NOT NULL,
                    CONSTRAINT [PK_Branches] PRIMARY KEY ([Id])
                );
            END
            """);

        // nvarchar(max) cannot be used in index keys in SQL Server; EF uses 450 for indexed strings.
        db.Database.ExecuteSqlRaw("""
            IF OBJECT_ID(N'BranchTimeSlots', N'U') IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM sys.indexes i
                WHERE i.object_id = OBJECT_ID(N'BranchTimeSlots')
                  AND i.name = N'IX_BranchTimeSlots_BranchId_Label')
            BEGIN
                DROP TABLE [BranchTimeSlots];
            END
            """);

        db.Database.ExecuteSqlRaw("""
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'BranchTimeSlots')
            BEGIN
                CREATE TABLE [BranchTimeSlots] (
                    [Id] int NOT NULL IDENTITY,
                    [BranchId] int NOT NULL,
                    [Label] nvarchar(450) NOT NULL,
                    [Capacity] int NOT NULL,
                    [BookedCount] int NOT NULL,
                    CONSTRAINT [PK_BranchTimeSlots] PRIMARY KEY ([Id]),
                    CONSTRAINT [FK_BranchTimeSlots_Branches_BranchId] FOREIGN KEY ([BranchId])
                        REFERENCES [Branches] ([Id]) ON DELETE CASCADE
                );
                CREATE UNIQUE INDEX [IX_BranchTimeSlots_BranchId_Label]
                    ON [BranchTimeSlots] ([BranchId], [Label]);
            END
            """);

        db.Database.ExecuteSqlRaw("""
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'QueueTickets')
            BEGIN
                CREATE TABLE [QueueTickets] (
                    [Id] int NOT NULL IDENTITY,
                    [UserId] int NOT NULL,
                    [BranchId] int NOT NULL,
                    [ServiceType] nvarchar(max) NOT NULL,
                    [TimeSlotLabel] nvarchar(max) NOT NULL,
                    [QueueLabel] nvarchar(max) NOT NULL,
                    [QueueNumber] int NOT NULL,
                    [Status] nvarchar(max) NOT NULL,
                    [CreatedAtUtc] datetime2 NOT NULL,
                    CONSTRAINT [PK_QueueTickets] PRIMARY KEY ([Id]),
                    CONSTRAINT [FK_QueueTickets_UserAccounts_UserId] FOREIGN KEY ([UserId])
                        REFERENCES [UserAccounts] ([Id]),
                    CONSTRAINT [FK_QueueTickets_Branches_BranchId] FOREIGN KEY ([BranchId])
                        REFERENCES [Branches] ([Id])
                );
                CREATE INDEX [IX_QueueTickets_UserId] ON [QueueTickets] ([UserId]);
                CREATE INDEX [IX_QueueTickets_BranchId] ON [QueueTickets] ([BranchId]);
            END
            """);

        ApplyBranchDirectoryColumns(db);
    }

    /// <summary>Adds state/address/geo columns for branch-locator style listings (idempotent for older DBs).</summary>
    private static void ApplyBranchDirectoryColumns(AppDbContext db)
    {
        db.Database.ExecuteSqlRaw("""
            IF COL_LENGTH(N'Branches', N'State') IS NULL
            ALTER TABLE [Branches] ADD [State] nvarchar(100) NOT NULL CONSTRAINT [DF_Branches_State] DEFAULT N'';
            """);
        db.Database.ExecuteSqlRaw("""
            IF COL_LENGTH(N'Branches', N'Address') IS NULL
            ALTER TABLE [Branches] ADD [Address] nvarchar(500) NULL;
            """);
        db.Database.ExecuteSqlRaw("""
            IF COL_LENGTH(N'Branches', N'Phone') IS NULL
            ALTER TABLE [Branches] ADD [Phone] nvarchar(80) NULL;
            """);
        db.Database.ExecuteSqlRaw("""
            IF COL_LENGTH(N'Branches', N'PlaceId') IS NULL
            ALTER TABLE [Branches] ADD [PlaceId] nvarchar(200) NULL;
            """);
        db.Database.ExecuteSqlRaw("""
            IF COL_LENGTH(N'Branches', N'Latitude') IS NULL
            ALTER TABLE [Branches] ADD [Latitude] float NULL;
            """);
        db.Database.ExecuteSqlRaw("""
            IF COL_LENGTH(N'Branches', N'Longitude') IS NULL
            ALTER TABLE [Branches] ADD [Longitude] float NULL;
            """);

        // Backfill older demo rows so GPS / state filters work without reseeding.
        db.Database.ExecuteSqlRaw("""
            UPDATE [Branches] SET [State]=N'Kuala Lumpur',[Address]=N'KL Sentral (demo — replace from official PBE branch data)',[Phone]=N'03-0000 0001',[Latitude]=3.1344,[Longitude]=101.6862
            WHERE [Name]=N'BDS KL Sentral' AND [Latitude] IS NULL;
            """);
        db.Database.ExecuteSqlRaw("""
            UPDATE [Branches] SET [State]=N'Kuala Lumpur',[Address]=N'Mid Valley (demo)',[Phone]=N'03-0000 0002',[Latitude]=3.1187,[Longitude]=101.6765
            WHERE [Name]=N'BDS Mid Valley' AND [Latitude] IS NULL;
            """);
        db.Database.ExecuteSqlRaw("""
            UPDATE [Branches] SET [State]=N'Kuala Lumpur',[Address]=N'Bangsar (demo)',[Phone]=N'03-0000 0003',[Latitude]=3.1291,[Longitude]=101.6711
            WHERE [Name]=N'BDS Bangsar' AND [Latitude] IS NULL;
            """);
        db.Database.ExecuteSqlRaw("""
            UPDATE [Branches] SET [State]=N'Selangor',[Address]=N'Damansara (demo)',[Phone]=N'03-0000 0004',[Latitude]=3.1466,[Longitude]=101.6292
            WHERE [Name]=N'BDS Damansara' AND [Latitude] IS NULL;
            """);
    }
}
