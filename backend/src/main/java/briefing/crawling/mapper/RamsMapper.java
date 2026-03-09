package briefing.crawling.mapper;

import java.time.OffsetDateTime;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;

import briefing.crawling.dto.rams.Rams;
import briefing.crawling.dto.request.RamRequest;

@Mapper
public interface RamsMapper {

    List<Rams> getRamsList(RamRequest keyword);

    void insertRams(List<Rams> ramsList);

    OffsetDateTime getLastDatetime();
}
