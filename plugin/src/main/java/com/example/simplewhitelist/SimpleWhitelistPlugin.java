package com.example.simplewhitelist;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;

public class SimpleWhitelistPlugin extends JavaPlugin {

    private WhitelistDatabase db;

    @Override
    public void onEnable() {
        saveDefaultConfig();

        String path = getConfig().getString("database-path", "plugins/SimpleWhitelist/whitelist.db");
        File dbFile = new File(path);
        if (!dbFile.isAbsolute()) {
            dbFile = new File(getServer().getWorldContainer(), path);
        }

        db = new WhitelistDatabase(dbFile, getLogger());
        db.init();

        getLogger().info("Using whitelist database at: " + dbFile.getAbsolutePath());
        getLogger().info("Point your webapp's DB_PATH env var at this exact file to manage the whitelist remotely.");

        boolean logConnections = getConfig().getBoolean("log-connections", true);
        String kickMessage = getConfig().getString("kick-message", "&cYou are not whitelisted on this server.");

        getServer().getPluginManager().registerEvents(
                new WhitelistListener(db, kickMessage, logConnections), this);

        int syncIntervalSeconds = getConfig().getInt("sync-interval-seconds", 2);
        if (syncIntervalSeconds > 0) {
            long ticks = syncIntervalSeconds * 20L;
            getServer().getScheduler().runTaskTimer(this, () -> {
                for (Player player : getServer().getOnlinePlayers()) {
                    if (!db.isWhitelisted(player.getUniqueId())) {
                        Component message = LegacyComponentSerializer.legacyAmpersand().deserialize(kickMessage);
                        player.kick(message);
                    }
                }
            }, ticks, ticks);
        }
    }

    public void reloadPluginConfig() {
        reloadConfig();
    }

    public WhitelistDatabase getDatabase() {
        return db;
    }
}
