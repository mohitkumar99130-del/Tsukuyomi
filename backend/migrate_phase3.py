import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "tsukuyomi.db")

def migrate():
    print(f"Connecting to {DB_PATH} for Phase 3 Migration...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    new_columns = {
        "primary_email_status": "TEXT",
        "primary_sent_at": "TEXT",
        "acknowledged": "INTEGER DEFAULT 0",
        "acknowledged_at": "TEXT",
        "secondary_email_status": "TEXT",
        "secondary_sent_at": "TEXT",
        "campus_email_status": "TEXT",
        "campus_sent_at": "TEXT",
        "escalation_status": "TEXT"
    }

    cursor.execute("PRAGMA table_info(incidents)")
    existing_columns = [col[1] for col in cursor.fetchall()]

    for col_name, col_type in new_columns.items():
        if col_name not in existing_columns:
            print(f"Adding column: {col_name} {col_type}")
            cursor.execute(f"ALTER TABLE incidents ADD COLUMN {col_name} {col_type}")
        else:
            print(f"Column already exists: {col_name}")
            
    conn.commit()
    conn.close()
    print("Phase 3 Database migration complete.")

if __name__ == "__main__":
    migrate()
