-- ============================================================
-- Kaynab AI - Drop Unused Tables (Darkpen Legacy)
-- Run this in Hostinger phpMyAdmin > SQL tab
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Old school/curriculum tables
DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS book_embeddings;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS schools;

-- Shukaansi (dating) feature - not part of Kaynab AI
DROP TABLE IF EXISTS shukaansi_messages;
DROP TABLE IF EXISTS shukaansi_subscriptions;
DROP TABLE IF EXISTS shukaansi_wallet;

-- Group chat tables (can be re-added later if needed)
DROP TABLE IF EXISTS messages_group;
DROP TABLE IF EXISTS group_registrations;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Verify remaining tables (should show only Kaynab AI tables)
-- ============================================================
SHOW TABLES;
