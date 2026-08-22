export type TeamMoment = {
  src: string;
  alt: string;
  label: string;
  meta: string;
};

export const teamMoments: readonly TeamMoment[] = [
  {
    src: "/team/moments/night-celebration-toss.jpg",
    alt: "夜场比赛结束后，机电学院足球队队员共同庆祝",
    label: "把胜利抛向夜空",
    meta: "终场之后 · 全队庆祝",
  },
  {
    src: "/team/moments/night-champions-cup.jpg",
    alt: "机电学院足球队队员与奖杯在夜场合影",
    label: "奖杯与并肩的人",
    meta: "球队合影 · 真实档案",
  },
  {
    src: "/team/moments/night-applause.jpg",
    alt: "夜场灯光下，机电学院足球队队员列队鼓掌",
    label: "掌声留给每一位队友",
    meta: "赛后时刻 · 蓝色战袍",
  },
  {
    src: "/team/moments/night-finale-run.jpg",
    alt: "机电学院足球队队员在夜场共同跑向场边",
    label: "一起奔向终场",
    meta: "团队瞬间 · 夜场",
  },
  {
    src: "/team/moments/sunset-match.jpg",
    alt: "夕阳下进行中的校园足球比赛",
    label: "阳光落在球场中央",
    meta: "比赛现场 · 绿茵日常",
  },
  {
    src: "/team/moments/sunset-number-13.jpg",
    alt: "蓝色十三号球员在夕阳下准备处理来球",
    label: "十三号的一个瞬间",
    meta: "蓝色战袍 · 比赛现场",
  },
  {
    src: "/team/moments/goalkeeper-ready.jpg",
    alt: "守门员在球门前抱球观察场上局势",
    label: "门前的冷静",
    meta: "守门员 · 比赛准备",
  },
  {
    src: "/team/moments/team-huddle.jpg",
    alt: "机电学院足球队队员在比赛前围成一圈",
    label: "开球前的同一个声音",
    meta: "全队围拢 · 团队时刻",
  },
  {
    src: "/team/moments/trophy-lineup.jpg",
    alt: "足球场边依次摆放的冠军奖杯",
    label: "奖杯会说话",
    meta: "荣誉现场 · 奖杯陈列",
  },
] as const;

export type PublicSeasonFoundation = {
  id: number;
  season: string;
  squad: "men-futsal" | "men-11" | "women-futsal";
  slug: string;
  title: string;
  summary: string;
  story: string;
  coverMediaId: null;
  coverImageUrl: string;
  createdAt: string;
  updatedAt: string;
  foundation: true;
};

const archiveUpdatedAt = "2026-08-16T00:00:00.000Z";

function foundation(
  id: number,
  season: string,
  squad: PublicSeasonFoundation["squad"],
  slug: string,
  title: string,
  summary: string,
  coverImageUrl: string,
): PublicSeasonFoundation {
  return {
    id,
    season,
    squad,
    slug,
    title,
    summary,
    story: `目前能够公开确认的资料是“${title}”。当届阵容、比赛过程、完整赛程与更多原始影像仍在征集；网站不会用推测填补空白，所有新增内容都需要经过管理员核实。`,
    coverMediaId: null,
    coverImageUrl,
    createdAt: archiveUpdatedAt,
    updatedAt: archiveUpdatedAt,
    foundation: true,
  };
}

export const knownSeasonArchives: readonly PublicSeasonFoundation[] = [
  foundation(-202201, "2022", "men-futsal", "2022-men-futsal", "2022 男子五人制 · 冠军赛季", "男子五人制冠军 · 已确认荣誉", "/team/five-years.jpg"),
  foundation(-202301, "2023", "men-futsal", "2023-men-futsal", "2023 男子五人制 · 冠军赛季", "男子五人制冠军 · 已确认荣誉", "/team/five-years.jpg"),
  foundation(-202401, "2024", "men-futsal", "2024-men-futsal", "2024 男子五人制 · 冠军赛季", "男子五人制冠军 · 已确认荣誉", "/team/five-years.jpg"),
  foundation(-202501, "2025", "men-futsal", "2025-men-futsal", "2025 男子五人制 · 冠军赛季", "男子五人制冠军 · 与女子五人制共用男子冠军纪念图", "/team/five-years.jpg"),
  foundation(-202502, "2025", "men-11", "2025-men-11", "2025 男子十一人制 · 冠军赛季", "男子十一人制冠军 · 已确认荣誉", "/team/night-team.jpg"),
  foundation(-202503, "2025", "women-futsal", "2025-women-futsal", "2025 女子五人制 · 冠军赛季", "女子五人制冠军 · 与男子五人制共用男子冠军纪念图", "/team/five-years.jpg"),
  foundation(-202601, "2026", "men-futsal", "2026-men-futsal", "2026 男子五人制 · 冠军赛季", "男子五人制冠军 · 已确认荣誉", "/team/five-years.jpg"),
] as const;

export const kitEvidence = [
  {
    image: "/team/moments/night-champions-cup.jpg",
    title: "蓝色比赛服",
    verified: "蓝色主体、白色领口与袖口、学院名称胸前排版",
    missing: "具体赛季、供应商、正背面平铺照",
  },
  {
    image: "/team/moments/sunset-number-13.jpg",
    title: "姓名与大号背号",
    verified: "背部姓名、两位数号码和学校名称能够清晰辨认",
    missing: "号码字体源文件、当年完整号码名单",
  },
  {
    image: "/team/moments/goalkeeper-ready.jpg",
    title: "守门员装备",
    verified: "长袖训练上衣、护膝、手套与门将短裤",
    missing: "对应赛季、主客场版本与装备故事",
  },
  {
    image: "/team/moments/team-huddle.jpg",
    title: "同一件战袍",
    verified: "真实比赛现场中的团队穿着与使用状态",
    missing: "每位队员当季号码及实物保存情况",
  },
] as const;
