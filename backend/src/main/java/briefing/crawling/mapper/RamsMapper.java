package briefing.crawling.mapper;

import java.time.LocalDateTime;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;

import briefing.crawling.dto.rams.Rams;
import briefing.crawling.dto.request.RamRequest;

@Mapper
public interface RamsMapper {

    List<Rams> getRamsList(RamRequest keyword);

    void insertRams(List<Rams> ramsList);

    LocalDateTime getLastDatetime();
}
