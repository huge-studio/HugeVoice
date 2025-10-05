using HugeVoice.Server.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Add Blazor WASM hosting support
builder.Services.AddRazorPages();

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

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseWebAssemblyDebugging();
}
else
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();

// Serve Blazor WASM static files
app.UseBlazorFrameworkFiles();
app.UseStaticFiles();

app.UseRouting();

app.MapHub<AudioStreamHub>("/audiohub");

// Fallback to serve the Blazor WASM app
app.MapFallbackToFile("index.html");

app.Run();
