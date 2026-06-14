using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using TwinkleTune.Application.Duet;
using TwinkleTune.Application.Services;

namespace TwinkleTune.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.TryAddSingleton(TimeProvider.System);
        services.AddScoped<IAvatarService, AvatarService>();
        services.AddScoped<ISingerService, SingerService>();
        services.AddScoped<ISongService, SongService>();
        services.AddScoped<IHighScoreService, HighScoreService>();
        services.AddSingleton<IRoomService, RoomService>();
        return services;
    }
}
