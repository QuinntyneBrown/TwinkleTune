using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TwinkleTune.Application.Abstractions;
using TwinkleTune.Infrastructure.Persistence;
using TwinkleTune.Infrastructure.Repositories;
using TwinkleTune.Infrastructure.Storage;

namespace TwinkleTune.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, string connectionString, string photosPath)
    {
        services.AddDbContext<AppDbContext>(o => o.UseSqlite(connectionString));
        services.AddScoped<IAvatarRepository, AvatarRepository>();
        services.AddScoped<ISingerRepository, SingerRepository>();
        services.AddScoped<ISongRepository, SongRepository>();
        services.AddScoped<IHighScoreRepository, HighScoreRepository>();
        services.AddSingleton<IPhotoStorage>(new PhotoStorage(photosPath));
        return services;
    }
}
