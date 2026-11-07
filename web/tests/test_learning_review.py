from pathlib import Path

from fastapi.testclient import TestClient

from web.server.main import create_app

ORIGIN = {"Origin": "http://127.0.0.1:5173"}


def test_flashcards_include_saved_sentences_and_filter_categories_in_scope(tmp_path: Path) -> None:
    with TestClient(create_app(tmp_path / "flashcards.sqlite3")) as learner:
        learner.post("/api/auth/register", json={"username": "learner", "password": "pass"}, headers=ORIGIN)
        root = learner.post("/api/folders", json={"name": "Root"}, headers=ORIGIN).json()["id"]
        child = learner.post("/api/folders", json={"name": "Child", "parent_id": root}, headers=ORIGIN).json()["id"]
        outside = learner.post("/api/folders", json={"name": "Outside"}, headers=ORIGIN).json()["id"]
        word = learner.post("/api/items", json={"folder_id": root, "category": "word", "text": "终于", "meaning": "cuối cùng"}, headers=ORIGIN).json()["id"]
        sentence = learner.post("/api/items", json={"folder_id": child, "category": "sentence", "text": "我终于找到工作了。", "meaning": "Cuối cùng tôi đã tìm được việc."}, headers=ORIGIN).json()["id"]
        learner.post("/api/items", json={"folder_id": outside, "category": "sentence", "text": "你好。", "meaning": "Xin chào."}, headers=ORIGIN)
        for category, expected in (("all", {word, sentence}), ("word", {word}), ("sentence", {sentence})):
            response = learner.post("/api/review/sessions", json={"kind": "vocabulary", "folder_id": root, "category": category}, headers=ORIGIN)
            assert response.status_code == 201, response.text
            session = response.json()
            assert {card["item_ids"][0] for card in session["questions"]} == expected
        assert learner.put(f"/api/review/sessions/{session['id']}/results/{sentence}", json={"result": "remembered"}, headers=ORIGIN).status_code == 200
        overview = learner.get("/api/review/overview", params={"folder_id": root}).json()
        assert next(entry for entry in overview["entries"] if entry["id"] == sentence)["remembered"] == 1


def test_vocabulary_review_scope_and_partial_results(tmp_path: Path) -> None:
    with TestClient(create_app(tmp_path / "review.sqlite3")) as learner, TestClient(create_app(tmp_path / "review.sqlite3")) as other:
        assert learner.post("/api/auth/register", json={"username": "learner", "password": "pass"}, headers=ORIGIN).status_code == 201
        assert other.post("/api/auth/register", json={"username": "other", "password": "pass"}, headers=ORIGIN).status_code == 201
        root = learner.post("/api/folders", json={"name": "Root"}, headers=ORIGIN).json()["id"]
        child = learner.post("/api/folders", json={"name": "Child", "parent_id": root}, headers=ORIGIN).json()["id"]
        outside = learner.post("/api/folders", json={"name": "Outside"}, headers=ORIGIN).json()["id"]
        def word(folder: str, text: str) -> str:
            return learner.post("/api/items", json={"folder_id": folder, "category": "word", "text": text, "meaning": "nghĩa"}, headers=ORIGIN).json()["id"]
        first, second, excluded = word(root, "你好"), word(child, "学习"), word(outside, "中文")
        started = learner.post("/api/review/sessions", json={"kind": "vocabulary", "folder_id": root}, headers=ORIGIN)
        assert started.status_code == 201, started.text
        session = started.json()
        assert {card["item_ids"][0] for card in session["questions"]} == {first, second}
        assert excluded not in {card["item_ids"][0] for card in session["questions"]}
        assert learner.put(f"/api/review/sessions/{session['id']}/results/{first}", json={"result": "remembered"}, headers=ORIGIN).status_code == 200
        assert learner.put(f"/api/review/sessions/{session['id']}/results/{first}", json={"result": "not_yet"}, headers=ORIGIN).status_code == 200
        overview = learner.get("/api/review/overview", params={"folder_id": root}).json()
        assert overview["totals"] == {"remembered": 0, "not_yet": 1}
        assert next(row for row in overview["entries"] if row["id"] == second)["not_yet"] == 0
        assert other.get("/api/review/overview").json()["entries"] == []
        assert other.put(f"/api/review/sessions/{session['id']}/results/{first}", json={"result": "remembered"}, headers=ORIGIN).status_code == 404
        another = learner.post("/api/review/sessions", json={"kind": "vocabulary", "folder_id": root}, headers=ORIGIN).json()["id"]
        assert learner.put(f"/api/review/sessions/{another}/results/{first}", json={"result": "remembered"}, headers=ORIGIN).status_code == 200
        assert learner.get("/api/review/overview", params={"folder_id": root}).json()["totals"] == {"remembered": 1, "not_yet": 1}
        assert learner.get("/api/review/overview", params={"folder_id": outside}).json()["totals"] == {"remembered": 0, "not_yet": 0}
        assert learner.delete(f"/api/items/{first}", headers=ORIGIN).status_code == 204
        assert learner.get("/api/review/overview", params={"folder_id": root}).json()["totals"] == {"remembered": 0, "not_yet": 0}


def test_practice_resume_keeps_order_position_settings_and_results_after_restart(tmp_path: Path) -> None:
    database = tmp_path / "resume.sqlite3"
    with TestClient(create_app(database)) as learner:
        learner.post("/api/auth/register", json={"username": "learner", "password": "pass"}, headers=ORIGIN)
        folder = learner.post("/api/folders", json={"name": "Practice"}, headers=ORIGIN).json()["id"]
        for text in ("你好", "学习", "工作"):
            learner.post("/api/items", json={"folder_id": folder, "category": "word", "text": text, "meaning": "nghĩa"}, headers=ORIGIN)
        started = learner.post("/api/review/sessions", json={"kind": "vocabulary", "folder_id": folder, "category": "all", "practice": "listen", "prompt_mode": "pinyin", "autoplay": False}, headers=ORIGIN).json()
        first = started["questions"][0]["item_ids"][0]
        assert learner.put(f"/api/review/sessions/{started['id']}/results/{first}", json={"result": "remembered", "position": 1}, headers=ORIGIN).status_code == 200
        assert learner.patch(f"/api/review/sessions/{started['id']}/progress", json={"position": 2}, headers=ORIGIN).status_code == 200
        cookies = learner.cookies
    with TestClient(create_app(database)) as learner:
        learner.cookies.update(cookies)
        response = learner.get("/api/review/sessions/current")
        assert response.status_code == 200, response.text
        resumed = response.json()
        assert resumed["id"] == started["id"]
        assert resumed["questions"] == started["questions"]
        assert resumed["position"] == 2
        assert resumed["settings"] == {"folder_id": folder, "category": "all", "practice": "listen", "prompt_mode": "pinyin", "autoplay": False}
        assert resumed["results"] == {first: "remembered"}
        assert learner.get("/api/review/overview").json()["totals"] == {"remembered": 1, "not_yet": 0}


def test_resume_rejects_other_accounts_invalid_positions_and_trashed_content(tmp_path: Path) -> None:
    database = tmp_path / "private.sqlite3"
    with TestClient(create_app(database)) as learner, TestClient(create_app(database)) as other:
        learner.post("/api/auth/register", json={"username": "learner", "password": "pass"}, headers=ORIGIN)
        other.post("/api/auth/register", json={"username": "other", "password": "pass"}, headers=ORIGIN)
        folder = learner.post("/api/folders", json={"name": "Private"}, headers=ORIGIN).json()["id"]
        word = learner.post("/api/items", json={"folder_id": folder, "category": "word", "text": "你好", "meaning": "xin chào"}, headers=ORIGIN).json()["id"]
        session = learner.post("/api/review/sessions", json={"kind": "vocabulary"}, headers=ORIGIN).json()["id"]
        assert other.get("/api/review/sessions/current").json() is None
        assert other.get(f"/api/review/sessions/{session}").status_code == 404
        assert other.patch(f"/api/review/sessions/{session}/progress", json={"position": 0}, headers=ORIGIN).status_code == 404
        assert learner.put(f"/api/review/sessions/{session}/results/{word}", json={"result": "remembered", "position": 2}, headers=ORIGIN).status_code == 422
        assert learner.get("/api/review/overview").json()["totals"] == {"remembered": 0, "not_yet": 0}
        assert learner.delete(f"/api/items/{word}", headers=ORIGIN).status_code == 204
        assert learner.get("/api/review/sessions/current").json() is None
        assert learner.get(f"/api/review/sessions/{session}").status_code == 409
        assert learner.put(f"/api/review/sessions/{session}/results/{word}", json={"result": "remembered"}, headers=ORIGIN).status_code == 404


def test_shared_grammar_sentence_is_asked_once_with_only_scoped_entries(tmp_path: Path) -> None:
    with TestClient(create_app(tmp_path / "grammar.sqlite3")) as learner:
        learner.post("/api/auth/register", json={"username": "learner", "password": "pass"}, headers=ORIGIN)
        scope = learner.post("/api/folders", json={"name": "Scope"}, headers=ORIGIN).json()["id"]
        outside = learner.post("/api/folders", json={"name": "Outside"}, headers=ORIGIN).json()["id"]
        def entry(folder: str, category: str, text: str, meaning: str) -> str:
            response = learner.post("/api/items", json={"folder_id": folder, "category": category, "text": text, "meaning": meaning}, headers=ORIGIN)
            assert response.status_code == 201, response.text
            return response.json()["id"]
        sentence = entry(outside, "sentence", "我正在学习。", "Tôi đang học.")
        first = entry(scope, "grammar", "正在 + V", "đang")
        second = entry(scope, "grammar", "主语 + V", "chủ ngữ")
        excluded = entry(outside, "grammar", "另一个", "khác")
        missing = entry(scope, "grammar", "没有例子", "không có ví dụ")
        for grammar in (first, second, excluded):
            assert learner.post(f"/api/items/{grammar}/links", json={"item_id": sentence}, headers=ORIGIN).status_code == 201
        session = learner.post("/api/review/sessions", json={"kind": "grammar", "folder_id": scope}, headers=ORIGIN).json()
        assert session["ineligible_count"] == 1
        assert session["ineligible_item_ids"] == [missing]
        assert len(session["questions"]) == 1
        question = session["questions"][0]
        assert question["sentence"]["id"] == sentence
        assert set(question["item_ids"]) == {first, second}
        assert excluded not in question["item_ids"] and missing not in question["item_ids"]
        for item_id, result in ((first, "not_yet"), (second, "remembered")):
            assert learner.put(f"/api/review/sessions/{session['id']}/results/{item_id}", json={"result": result}, headers=ORIGIN).status_code == 200
        overview = learner.get("/api/review/overview", params={"folder_id": scope}).json()
        assert overview["totals"] == {"remembered": 1, "not_yet": 1}
