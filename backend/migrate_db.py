import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "tsukuyomi.db")

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check if columns exist before adding
    cursor.execute("PRAGMA table_info(incidents)")
    columns = [row[1] for row in cursor.fetchall()]
    
    new_columns = [
        ("ai_status", "TEXT"),
        ("ai_quality_score", "INTEGER"),
        ("ai_issues", "TEXT"),
        ("ai_context_summary", "TEXT"),
        ("ai_retry_requested", "INTEGER"),
        ("ai_original_score", "INTEGER"),
        ("ai_retry_score", "INTEGER"),
        ("ai_selected_photo", "TEXT"),
    ]
    
    for col_name, col_type in new_columns:
        if col_name not in columns:
            print(f"Adding column {col_name}...")
            cursor.execute(f"ALTER TABLE incidents ADD COLUMN {col_name} {col_type}")
            
    conn.commit()
    conn.close()
    print("Migration completed.")

if __name__ == "__main__":
    migrate()
