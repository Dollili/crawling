package briefing.crawling.service;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

import com.microsoft.playwright.*;
import com.microsoft.playwright.options.LoadState;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import briefing.crawling.dto.rams.Rams;
import briefing.crawling.dto.request.RamRequest;
import briefing.crawling.mapper.RamsMapper;

@Service
public class RamsService {
    private static final Logger logger = LoggerFactory.getLogger(RamsService.class);

    private final RamsMapper ramsMapper;

    private static final String URL = "https://prod.danawa.com/list/?cate=112752";
    private static final String MAKER_ID = "searchMakerRep702";

    private static final List<String> DDR_TYPES = List.of("DDR4", "DDR5");
    private static final List<String> CAPACITIES = List.of("8GB", "16GB", "32GB", "64GB");

    public RamsService(RamsMapper ramsMapper) {
        this.ramsMapper = ramsMapper;
    }

    public List<Rams> getRamsList(RamRequest keyword) {
        return ramsMapper.getRamsList(keyword);
    }

    public OffsetDateTime getLatestDate() {
        return ramsMapper.getLastDatetime();
    }

    @Transactional
    public void insertRams() {
        List<Rams> list = collect();
        ramsMapper.insertRams(list);
    }

    public List<Rams> collect() {
        List<Rams> ramsList = new ArrayList<>();

        try (Playwright playwright = Playwright.create()) {
            Browser browser = playwright.chromium().launch(
                new BrowserType.LaunchOptions()
                    .setHeadless(true)
                    .setSlowMo(50)
            );

            Page page = browser.newContext(
                new Browser.NewContextOptions()
                    .setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            ).newPage();

            page.navigate(URL);
            page.waitForLoadState(LoadState.NETWORKIDLE);

            // 삼성전자 필터 체크
            page.click("#" + MAKER_ID);
            page.waitForLoadState(LoadState.NETWORKIDLE);

            for (String ddrType : DDR_TYPES) {

                toggleFilter(page, "제품 분류", ddrType, true);

                for (String capacity : CAPACITIES) {

                    toggleFilter(page, "메모리 용량", capacity, true);

                    // 최저가 1건 수집
                    String priceStr = collectLowestPrice(page);
                    logger.info("[결과] {} / {} → {}", ddrType, capacity, priceStr);

                    int price = 0;
                    try {
                        price = Integer.parseInt(priceStr.replaceAll("[^0-9]", ""));
                    } catch (NumberFormatException e) {
                        logger.warn("가격 파싱 실패: {}", priceStr);
                    }

                    Rams rams = new Rams();
                    rams.setRamType(ddrType);
                    rams.setRamSize(capacity);
                    rams.setCurrentPrice(price);
                    rams.setRegisterDate(LocalDateTime.now());

                    ramsList.add(rams);

                    toggleFilter(page, "메모리 용량", capacity, false);
                }

                toggleFilter(page, "제품 분류", ddrType, false);
            }

            logger.info("=== 총 {}건 수집 ===", ramsList.size());
            page.close();
            browser.close();
        }

        return ramsList;
    }

    private void toggleFilter(Page page, String categoryName, String targetText, boolean check) {
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

                if (matched.isEmpty()) {
                    ElementHandle anchor = subItem.querySelector("a");
                    if (anchor != null && anchor.innerText().trim().equals(targetText))
                        matched = "anchor";
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

    // 광고 제외
    private String collectLowestPrice(Page page) {
        String price = (String)page.evaluate("""
                () => {
                    const items = document.querySelectorAll('#productListArea');
                    for (const item of items) {
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
