package briefing.crawling;

import com.microsoft.playwright.*;
import com.microsoft.playwright.options.LoadState;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 다나와 삼성전자 RAM 가격 크롤링 테스트
 * DDR4 / DDR5 x 8GB / 16GB / 32GB / 64GB → 각 1건씩 최저가 로그 출력
 */
class DanawaCrawlingTest {

    private static final Logger log = LoggerFactory.getLogger(DanawaCrawlingTest.class);

    private static final String URL = "https://prod.danawa.com/list/?cate=112752";
    private static final String MAKER_ID = "searchMakerRep702";

    private static final List<String> DDR_TYPES = List.of("DDR4", "DDR5");
    private static final List<String> CAPACITIES = List.of("8GB", "16GB", "32GB", "64GB");

    private static Playwright playwright;
    private static Browser browser;

    @BeforeAll
    static void setup() {
        playwright = Playwright.create();
        browser = playwright.chromium().launch(
            new BrowserType.LaunchOptions()
                .setHeadless(true)
                .setSlowMo(300)
        );
    }

    @AfterAll
    static void teardown() {
        browser.close();
        playwright.close();
    }

    @Test
    void crawlSamsungRamPrices() {
        Page page = browser.newContext(
            new Browser.NewContextOptions()
                .setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        ).newPage();

        log.info("=== 다나와 삼성전자 RAM 크롤링 시작 ===");

        page.navigate(URL);
        page.waitForLoadState(LoadState.NETWORKIDLE);

        page.click("#" + MAKER_ID);
        page.waitForLoadState(LoadState.NETWORKIDLE);
        log.info("[삼성전자] 필터 체크 완료");

        Map<String, String> result = new LinkedHashMap<>();

        for (String ddrType : DDR_TYPES) {

            toggleFilter(page, "제품 분류", ddrType, true);
            log.info("[{}] 제품분류 필터 체크", ddrType);

            for (String capacity : CAPACITIES) {

                toggleFilter(page, "메모리 용량", capacity, true);
                log.info("[{}][{}] 용량 필터 체크", ddrType, capacity);

                // 광고 제외 후 최저가 1건 수집
                String price = collectLowestPrice(page);
                String key = ddrType + " / " + capacity;
                result.put(key, price);
                log.info("[결과] {} → {}", key, price);

                toggleFilter(page, "메모리 용량", capacity, false);
            }

            toggleFilter(page, "제품 분류", ddrType, false);
        }

        // 최종 결과 출력
        log.info("========== 크롤링 결과 요약 ==========");
        result.forEach((k, v) -> log.info("  {} : {}", k, v));
        log.info("=====================================");

        page.close();
    }

    private void toggleFilter(Page page, String categoryName, String targetText, boolean check) {
        //List<ElementHandle> categories = page.querySelectorAll(".item_dd");
        List<ElementHandle> categories = page.querySelectorAll(".spec_item");
        for (ElementHandle category : categories) {
            String cgy = category.querySelector(".item_dt").innerText();
            if (!cgy.contains(categoryName))
                continue;

            List<ElementHandle> subItems = category.querySelectorAll(".item_dd .sub_item");
            for (ElementHandle subItem : subItems) {
                String matched = "";
                ElementHandle label = subItem.querySelector("label");
                if (label != null) {
                    String title = label.getAttribute("title");
                    if (title != null && title.trim().equals(targetText))
                        matched = "label";
                }

                // 없는 경우 innerText 활용
                if (matched.isEmpty()) {
                    ElementHandle anchor = subItem.querySelector("a");
                    if (anchor != null && anchor.innerText().trim().equals(targetText)) {
                        matched = "anchor";
                    }
                }

                if (matched.isEmpty())
                    continue;

                ElementHandle checkbox = subItem.querySelector("input[type='checkbox']");
                if (checkbox == null)
                    continue;

                boolean isChecked = (boolean)checkbox.evaluate("el => el.checked");
                if (check != isChecked) {
                    checkbox.click();
                    page.waitForLoadState(LoadState.NETWORKIDLE);
                }
                break;
            }
            break;
        }
    }

    private String collectLowestPrice(Page page) {
        String price = (String)page.evaluate("""
                () => {
                    const items = document.querySelectorAll('#productListArea');
                    for (const item of items) {
                        // 광고 영역 제외
                        if (item.classList.contains('powershopping-prod')
                        || item.classList.contains('popup_ad_floating')) continue;
            
                        const strong = item.querySelector('.price_sect a strong');
                        if (strong && strong.innerText.trim()) {
                            return strong.innerText.trim();
                        }
                    }
                    return '가격 없음';
                }
            """);

        return price != null ? price : "가격 없음";
    }
}
