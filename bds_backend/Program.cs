using System.Text;
using bds_backend.Data;
using bds_backend.Options;
using bds_backend.Security;
using bds_backend.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddScoped<PasswordService>();
builder.Services.AddScoped<JwtTokenService>();
builder.Services.Configure<BranchDirectoryOptions>(
    builder.Configuration.GetSection(BranchDirectoryOptions.SectionName));
builder.Services.Configure<GoogleMapsOptions>(
    builder.Configuration.GetSection(GoogleMapsOptions.SectionName));
builder.Services.AddHttpClient("WaitPrediction", client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
});
builder.Services.AddHttpClient("GoogleRoutes", client =>
{
    client.Timeout = TimeSpan.FromSeconds(20);
});
builder.Services.AddScoped<WaitPredictionService>();
builder.Services.AddScoped<BranchDirectorySyncService>();
builder.Services.AddScoped<GoogleRoutesService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AppClients", policy =>
        policy.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin());
});

var jwtKey = builder.Configuration["Jwt:Key"] ?? "change-this-dev-key-to-long-secret";
var keyBytes = Encoding.UTF8.GetBytes(jwtKey);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(keyBytes),
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
    EnsureBranchQueueSchema.ApplyIfNeeded(db);
    DbSeed.SeedBranches(db);
    DbSeed.SeedBranchDirectoryExpansion(db);
    var branchDirectorySync = scope.ServiceProvider.GetRequiredService<BranchDirectorySyncService>();
    await branchDirectorySync.SyncFromFileIfPresentAsync(db);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseCors("AppClients");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();
