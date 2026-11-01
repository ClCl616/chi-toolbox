"""Toolbox projection. Pure policy helpers; no LMS or Discord I/O."""
import copy
from datetime import datetime, timedelta, timezone
import json

LABELS = {"notice": "공지", "material": "강의자료", "assignment": "과제", "exam": "시험·퀴즈", "lesson": "온라인 강의"}
FIELDS = {"title": "제목", "body_text": "본문", "description_text": "설명", "start_local": "시작 시각", "end_local": "마감 시각", "submitted": "제출 상태", "content_reference_digest": "링크·이미지 참조", "attachment_names": "첨부 목록", "attempted": "응시 상태", "extension_deadline_text": "연장 기한"}

def date_value(value, offset=None):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
        if parsed.tzinfo is None:
            if offset is None:
                return None
            parsed = parsed.replace(tzinfo=timezone(timedelta(minutes=offset)))
        return parsed.isoformat()
    except (ValueError, TypeError):
        return None

def initial_state():
    return {"version": 1, "events": [], "assignments": [], "lastSuccess": None,
            "_lastChange": 0, "_fault": "", "_assignments": {}}

def project(connection, previous, results, issues, now, offset=None):
    state = copy.deepcopy(previous or initial_state())
    events = state["events"]
    def emit(kind, title, body, course="", category="상태 알림", detected_at=None):
        sequence = (events[-1]["sequence"] if events else 0) + 1
        events.append({"id": f"event:{sequence}", "sequence": sequence, "kind": kind,
                       "title": title, "body": body, "course": course, "category": category,
                       "detectedAt": detected_at or now})

    rows = connection.execute("""SELECT c.change_id,c.kind,c.before_json,c.after_json,
        i.item_type,r.recorded_at,co.display_name FROM changes c
        JOIN items i USING(item_id) JOIN runs r USING(run_id) JOIN courses co USING(course_id)
        WHERE c.change_id>? ORDER BY c.change_id""", (state["_lastChange"],)).fetchall()
    for row in rows:
        state["_lastChange"] = row[0]
        if row[1] not in ("new", "modified"):
            continue
        after, before = json.loads(row[3]), json.loads(row[2] or "{}")
        body = after.get("body_text") or after.get("description_text") or ""
        if row[1] == "modified":
            changed = [FIELDS.get(key, "상세 정보") for key in sorted(set(before) | set(after))
                       if before.get(key) != after.get(key) and key not in ("board_reference_policy", "progress_percent", "progress_text")]
            body = "변경: " + ", ".join(dict.fromkeys(changed)) + ("\n\n" + body if body else "")
        emit("news", after.get("title") or "제목 미확인", body[:50000], row[6] or "과목명 미확인",
             LABELS.get(row[4], "LMS") + (" · 변경" if row[1] == "modified" else " · 신규"), row[5])

    # Keep last good assignments on partial/auth failure. Missing rows are never deletions.
    for items in state["_assignments"].values():
        for item in items:
            item["stale"] = True
    for result in results:
        if result.item_type != "assignment" or result.status.value != "success":
            continue
        latest = connection.execute("""SELECT cr.result_id FROM collection_results cr
            WHERE course_id=? AND item_type='assignment' AND status='success'
            ORDER BY result_id DESC LIMIT 1""", (result.course_id,)).fetchone()
        if not latest:
            continue
        items = []
        for row in connection.execute("""SELECT i.item_id,s.payload_json FROM snapshots s
            JOIN items i USING(item_id) WHERE result_id=?""", (latest[0],)):
            payload = json.loads(row[1])
            items.append({"id": str(row[0]), "course": result.course_name or "과목명 미확인",
                          "title": payload.get("title") or "제목 미확인", "submitted": payload.get("submitted"),
                          "deadline": date_value(payload.get("end_local"), offset),
                          "deadlineText": payload.get("end_local") or "",
                          "extensionAllowed": payload.get("extension_allowed"),
                          "extensionDeadline": date_value(payload.get("extension_deadline_text"), offset),
                          "stale": False})
        prior = state["_assignments"].get(result.course_id, [])
        observed = {item["id"] for item in items}
        items.extend(item for item in prior if item["id"] not in observed)
        state["_assignments"][result.course_id] = items
    state["assignments"] = [item for items in state["_assignments"].values() for item in items]
    state["assignmentsReady"] = bool(state["_assignments"])
    fault = "|".join(sorted(set(issues)))
    if fault and fault != state["_fault"]:
        if "login_required" in fault:
            emit("system", "LMS 로그인이 필요해요", "수집 PC의 브라우저에서 다시 로그인해 주세요. 기존 정보는 유지됩니다.")
        elif "auth_unknown" in fault:
            emit("system", "LMS 인증 상태를 확인해 주세요", "수집 PC의 로그인 상태를 확인해 주세요. 기존 정보는 유지됩니다.")
        else:
            emit("system", "LMS 수집에 실패했어요", "일부 또는 전체 정보를 갱신하지 못했어요. 30분 간격으로 다시 확인합니다.")
    elif not fault and state["_fault"]:
        emit("system", "LMS 수집이 복구됐어요", "정상적으로 정보를 확인했습니다.")
    state["_fault"] = fault
    success = any(result.status.value == "success" for result in results)
    state["status"] = ("login_required" if "login_required" in fault else "unknown" if "auth_unknown" in fault
                       else "partial" if fault and success else "failed" if fault else "healthy")
    state["lastAttempt"] = now
    if success or not fault:
        state["lastSuccess"] = now
    return state

def public_snapshot(state):
    return {key: value for key, value in state.items() if not key.startswith("_")}
