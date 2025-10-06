using HugeVoice.Server.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Add services for Blazor WebAssembly hosting
builder.Services.AddSignalR();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseWebAssemblyDebugging();
}
else
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseBlazorFrameworkFiles();
app.UseStaticFiles();

app.UseRouting();

// Map SignalR Hub
app.MapHub<AudioStreamHub>("/audiohub");

// Serve Blazor WebAssembly
app.MapFallbackToFile("index.html");

if (app.Environment.IsDevelopment())
{
    app.Logger.LogInformation("HugeVoice Server started - hosting Blazor WebAssembly");
    app.Logger.LogInformation("SignalR Hub mapped to /audiohub");
}

app.Run();
