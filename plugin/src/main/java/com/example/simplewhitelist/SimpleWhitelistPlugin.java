package com.example.simplewhitelist;

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
            // Relative paths resolve against the server's working directory (server root)
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
    }

    public void reloadPluginConfig() {
        reloadConfig();
    }

    public WhitelistDatabase getDatabase() {
        return db;
    }
}
