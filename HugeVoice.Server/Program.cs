using HugeVoice.Server.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Add services for Blazor WebAssembly hosting
builder.Services.AddSignalR();

// Add CORS for Blazor Client
builder.Services.AddCors(options =>
{
    options.AddPolicy("BlazorClient", policy =>
    {
        policy.WithOrigins("https://localhost:7167", "http://localhost:5263")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

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
app.UseCors("BlazorClient");

// Map SignalR Hub
app.MapHub<AudioStreamHub>("/audiohub");

// Serve Blazor WebAssembly
app.MapFallbackToFile("index.html");

app.Run();
