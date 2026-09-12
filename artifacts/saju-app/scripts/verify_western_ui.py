import json
from playwright.sync_api import sync_playwright

def person(identifier, name):
    return {"id": identifier, "birthInput": {"name": name, "gender": "여", "calendarType": "solar", "year": 1989, "month": 2, "day": 16, "hour": 19, "minute": 29, "timeUnknown": False}, "profile": {"computedPillars": {"year": {"hangul": "", "hanja": ""}, "month": {"hangul": "", "hanja": ""}, "day": {"hangul": "갑자", "hanja": ""}, "hour": None}, "fiveElementDistribution": {"목": 0, "화": 0, "토": 0, "금": 0, "수": 0}, "solarDate": {"year": 1989, "month": 2, "day": 16}, "rawResult": {}, "isTimeCorrected": False}, "createdAt": "2026-01-01", "updatedAt": "2026-01-01"}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 390, "height": 844})
    storage = {"myProfile": person("self", "나"), "people": [person("other", "상대")]}
    page.add_init_script(f"localStorage.setItem('saju_app_v1', JSON.stringify({json.dumps(storage, ensure_ascii=False)}))")

    base = "http://127.0.0.1:22817"
    page.goto(f"{base}/western/self")
    page.wait_for_url("**/western/self/overview")
    page.get_by_role("navigation", name="서양점성술 해석 주제").wait_for()
    assert page.get_by_test_id("western-topic-nav").evaluate("el => el.scrollWidth <= el.clientWidth")
    widths = page.get_by_test_id("western-topic-nav").locator("a").evaluate_all("els => els.map(el => el.getBoundingClientRect().width)")
    assert len(widths) == 4 and min(widths) >= 80
    assert page.get_by_role("link", name="출생지 설정").is_visible()

    page.goto(f"{base}/western/self/transit?month=2026-09")
    page.wait_for_load_state("networkidle")
    assert "month=2026-09" in page.url
    assert page.get_by_text("2026년 9월").is_visible()
    assert "text-primary" in page.get_by_role("link", name="시기운").get_attribute("class")
    page.get_by_role("button", name="다음 월").click()
    page.wait_for_url("**month=2026-10")

    page.goto(f"{base}/western/self/synastry/other")
    page.wait_for_url("**/western/self/synastry/other/overview")
    assert page.get_by_role("navigation", name="관계 분석 주제").locator("a").count() == 2
    assert "나, 상대" in page.get_by_role("alert").inner_text()
    browser.close()
