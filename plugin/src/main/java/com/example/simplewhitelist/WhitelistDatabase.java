package com.example.simplewhitelist;

import java.io.File;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.logging.Logger;

public class WhitelistDatabase {

    private final String jdbcUrl;
    private final Logger logger;

    public WhitelistDatabase(File dbFile, Logger logger) {
        this.logger = logger;
        File parent = dbFile.getParentFile();
        if (parent != null && !parent.exists()) {
            parent.mkdirs();
        }
        this.jdbcUrl = "jdbc:sqlite:" + dbFile.getAbsolutePath();
    }

    public void init() {
        try (Connection c = getConnection(); Statement st = c.createStatement()) {
            st.execute("PRAGMA journal_mode = WAL;");
            st.execute("PRAGMA synchronous = NORMAL;");
            st.execute("PRAGMA busy_timeout = 5000;");
            st.executeUpdate("""
                CREATE TABLE IF NOT EXISTS whitelist (
                    uuid TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    added_by TEXT,
                    added_at INTEGER
                )
                """);
            st.executeUpdate("""
                CREATE TABLE IF NOT EXISTS connections (
                    uuid TEXT,
                    username TEXT,
                    ip TEXT,
                    connected_at INTEGER
                )
                """);
            st.executeUpdate("CREATE INDEX IF NOT EXISTS idx_connections_uuid ON connections(uuid)");
            st.executeUpdate("""
                CREATE TABLE IF NOT EXISTS kicks (
                    uuid TEXT,
                    username TEXT,
                    ip TEXT,
                    reason TEXT,
                    kicked_at INTEGER
                )
                """);
            st.executeUpdate("CREATE INDEX IF NOT EXISTS idx_kicks_time ON kicks(kicked_at DESC)");
        } catch (SQLException e) {
            logger.severe("[SimpleWhitelist] Failed to initialize database: " + e.getMessage());
        }
    }

    private Connection getConnection() throws SQLException {
        Connection c = DriverManager.getConnection(jdbcUrl);
        try (Statement st = c.createStatement()) {
            st.execute("PRAGMA busy_timeout = 5000;");
        }
        return c;
    }

    public boolean isWhitelisted(UUID uuid) {
        String sql = "SELECT 1 FROM whitelist WHERE uuid = ? LIMIT 1";
        try (Connection c = getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, uuid.toString());
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        } catch (SQLException e) {
            logger.warning("[SimpleWhitelist] Whitelist lookup failed, denying by default: " + e.getMessage());
            return false;
        }
    }

    public boolean addPlayer(UUID uuid, String username, String addedBy) {
        String sql = """
            INSERT INTO whitelist (uuid, username, added_by, added_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(uuid) DO UPDATE SET username = excluded.username
            """;
        try (Connection c = getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, uuid.toString());
            ps.setString(2, username);
            ps.setString(3, addedBy);
            ps.setLong(4, System.currentTimeMillis());
            ps.executeUpdate();
            return true;
        } catch (SQLException e) {
            logger.warning("[SimpleWhitelist] Failed to add player: " + e.getMessage());
            return false;
        }
    }

    public boolean removePlayer(UUID uuid) {
        String sql = "DELETE FROM whitelist WHERE uuid = ?";
        try (Connection c = getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, uuid.toString());
            int rows = ps.executeUpdate();
            return rows > 0;
        } catch (SQLException e) {
            logger.warning("[SimpleWhitelist] Failed to remove player: " + e.getMessage());
            return false;
        }
    }

    public List<String> listPlayers() {
        List<String> names = new ArrayList<>();
        String sql = "SELECT username FROM whitelist ORDER BY username COLLATE NOCASE";
        try (Connection c = getConnection(); Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                names.add(rs.getString("username"));
            }
        } catch (SQLException e) {
            logger.warning("[SimpleWhitelist] Failed to list players: " + e.getMessage());
        }
        return names;
    }

    public void logConnection(UUID uuid, String username, String ip) {
        String sql = "INSERT INTO connections (uuid, username, ip, connected_at) VALUES (?, ?, ?, ?)";
        try (Connection c = getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, uuid.toString());
            ps.setString(2, username);
            ps.setString(3, ip);
            ps.setLong(4, System.currentTimeMillis());
            ps.executeUpdate();
        } catch (SQLException e) {
            logger.warning("[SimpleWhitelist] Failed to log connection: " + e.getMessage());
        }
    }

    public void logKick(UUID uuid, String username, String ip, String reason) {
        String sql = "INSERT INTO kicks (uuid, username, ip, reason, kicked_at) VALUES (?, ?, ?, ?, ?)";
        try (Connection c = getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, uuid.toString());
            ps.setString(2, username);
            ps.setString(3, ip);
            ps.setString(4, reason);
            ps.setLong(5, System.currentTimeMillis());
            ps.executeUpdate();
        } catch (SQLException e) {
            logger.warning("[SimpleWhitelist] Failed to log kick: " + e.getMessage());
        }
    }
}
