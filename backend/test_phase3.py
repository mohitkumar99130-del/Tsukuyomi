import os, time, requests, json

API = "http://localhost:8000"

WHITE_JPEG = (
    b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00'
    b'\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t'
    b'\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a'
    b'\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\x1e'
    b'AB\xcd\xc8\xa5+\x00\x00\x00\x01W\xff\xc0\x00\x0b\x08\x00\x01'
    b'\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01'
    b'\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02'
    b'\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xc4\x00\xb5\x10\x00\x02'
    b'\x01\x03\x03\x02\x04\x03\x05\x05\x04\x04\x00\x00\x01}\x01\x02'
    b'\x03\x00\x04\x11\x05\x12!1A\x06\x13Qa\x07"q\x142\x81\x91\xa1'
    b'\x08#B\xb1\xc1\x15R\xd1\xf0$3br\x82\t\n\x16\x17\x18\x19\x1a%'
    b'&\'()*456789:CDEFGHIJSTUVWXYZcdefghijstuvwxyz\x83\x84\x85\x86'
    b'\x87\x88\x89\x8a\x92\x93\x94\x95\x96\x97\x98\x99\x9a\xa2\xa3'
    b'\xa4\xa5\xa6\xa7\xa8\xa9\xaa\xb2\xb3\xb4\xb5\xb6\xb7\xb8\xb9'
    b'\xba\xc2\xc3\xc4\xc5\xc6\xc7\xc8\xc9\xca\xd2\xd3\xd4\xd5\xd6'
    b'\xd7\xd8\xd9\xda\xe1\xe2\xe3\xe4\xe5\xe6\xe7\xe8\xe9\xea\xf1'
    b'\xf2\xf3\xf4\xf5\xf6\xf7\xf8\xf9\xfa\xff\xda\x00\x08\x01\x01'
    b'\x00\x00?\x00\xfb\xd3P\x00\x00\x00\x1f\xff\xd9'
)

def trigger():
    from datetime import datetime, timezone
    resp = requests.post(
        f"{API}/api/trigger",
        data={
            "device_name": "TestDevice-Phase3",
            "latitude": 28.6139,
            "longitude": 77.2090,
            "accuracy": 5.0,
            "captured_at": datetime.now(timezone.utc).isoformat(),
        },
        files={"photo": ("test.jpg", WHITE_JPEG, "image/jpeg")},
        timeout=120,
    )
    res = resp.json()
    if res.get("status") == "retry_requested":
        inc_id = res["incident_id"]
        # Call retry-photo to finish the pipeline and trigger email
        requests.post(
            f"{API}/api/incidents/{inc_id}/retry-photo",
            files={"photo": ("retry.jpg", WHITE_JPEG, "image/jpeg")},
            timeout=120,
        )
        # Fetch the latest state to return it like a normal trigger
        time.sleep(1) # Ensure db is updated
        return requests.get(f"{API}/api/incidents/latest").json()
    return res

def acknowledge(inc_id):
    requests.post(f"{API}/api/incidents/{inc_id}/acknowledge")

def get_latest():
    return requests.get(f"{API}/api/incidents/latest").json().get("incident", {})

print("\n=== TEST C: PRIMARY FAILURE ===")
# Since SMTP is likely not configured with valid creds locally,
# it will fail immediately and escalation_status will be primary_delivery_failed.
res = trigger()
inc_id = res.get("incident", {}).get("id") or res.get("incident_id")
time.sleep(2)  # Give background loop a chance to run
inc = get_latest()
print(f"Primary Status: {inc.get('primary_email_status')}")
print(f"Escalation Status: {inc.get('escalation_status')}")
print(f"Secondary Status: {inc.get('secondary_email_status')}")
test_c_pass = inc.get('primary_email_status') == 'failed' and inc.get('secondary_email_status') == 'failed'

print("\n=== TEST A: ACKNOWLEDGED ===")
res = trigger()
inc_id = res.get("incident", {}).get("id") or res.get("incident_id")
acknowledge(inc_id)
time.sleep(2)
inc = get_latest()
print(f"Acknowledged: {inc.get('acknowledged')}")
print(f"Escalation Status: {inc.get('escalation_status')}")
test_a_pass = inc.get('acknowledged') == 1 and inc.get('escalation_status') == 'acknowledged'

print("\n=== TEST B & D: UNACKNOWLEDGED & CAMPUS DISABLED ===")
res = trigger()
inc_id = res.get("incident", {}).get("id") or res.get("incident_id")
# Wait for timeout (ESCALATION_TIMEOUT_SECONDS=20 in env)
print("Waiting 25 seconds for timeout...")
time.sleep(25)
inc = get_latest()
print(f"Escalation Status: {inc.get('escalation_status')}")
print(f"Secondary Status: {inc.get('secondary_email_status')}")
print(f"Campus Status: {inc.get('campus_email_status')}")
test_b_pass = inc.get('secondary_email_status') in ['sent', 'failed']
test_d_pass = inc.get('campus_email_status') is None

print("\n--- RESULTS ---")
print(f"TEST A (Acknowledged): {'PASS' if test_a_pass else 'FAIL'}")
print(f"TEST B (Unacknowledged timeout): {'PASS' if test_b_pass else 'FAIL'}")
print(f"TEST C (Primary Failure): {'PASS' if test_c_pass else 'FAIL'}")
print(f"TEST D (Campus Disabled): {'PASS' if test_d_pass else 'FAIL'}")
