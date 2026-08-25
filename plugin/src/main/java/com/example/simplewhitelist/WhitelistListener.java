package com.example.simplewhitelist;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.AsyncPlayerPreLoginEvent;
import org.bukkit.event.player.PlayerJoinEvent;

public class WhitelistListener implements Listener {

    private final WhitelistDatabase db;
    private final String kickMessage;
    private final boolean logConnections;

    public WhitelistListener(WhitelistDatabase db, String kickMessage, boolean logConnections) {
        this.db = db;
        this.kickMessage = kickMessage;
        this.logConnections = logConnections;
    }

    @EventHandler(priority = EventPriority.LOW)
    public void onPreLogin(AsyncPlayerPreLoginEvent event) {
        // Runs before the player joins; checks if allowed in SQLite database
        boolean allowed = db.isWhitelisted(event.getUniqueId());
        if (!allowed) {
            Component message = LegacyComponentSerializer.legacyAmpersand().deserialize(kickMessage);
            event.disallow(AsyncPlayerPreLoginEvent.Result.KICK_WHITELIST, message);
        }
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        if (!logConnections) return;
        String ip = "unknown";
        if (event.getPlayer().getAddress() != null && event.getPlayer().getAddress().getAddress() != null) {
            ip = event.getPlayer().getAddress().getAddress().getHostAddress();
        }
        db.logConnection(event.getPlayer().getUniqueId(), event.getPlayer().getName(), ip);
    }
}
