using HugeVox.Hubs;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorPages();
builder.Services.AddServerSideBlazor(options =>
{
    // Enable detailed errors for development
    options.DetailedErrors = builder.Environment.IsDevelopment();
});

builder.Services.AddSignalR(options =>
{
    // Increase message size limits for audio data
    options.MaximumReceiveMessageSize = 10 * 1024 * 1024; // 10MB
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    
    // Set timeouts for better connection stability
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(60);
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
});

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();

app.MapBlazorHub();
app.MapHub<AudioStreamHub>("/audiohub");
app.MapFallbackToPage("/_Host");

app.Run();
