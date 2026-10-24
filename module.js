import {
  F,
  S,
  R,
  C,
  live,
  rows,
  byId,
  unique,
  required,
  minor,
  amount,
  interval,
  noOverlap,
  changed,
  immutable,
  admin,
  totalLines,
  summary,
  clock,
  label,
} from "./core/rules.js";
const definition = {
  slug: "applylens",
  reference: 51,
  title: "ApplyLens",
  description:
    "Сопоставление собственного резюме с явными требованиями вакансии, без ATS-оценки и выдуманного опыта.",
  limitations:
    "Одна организация · Собственный сервер · Ручной ввод · Без банковских и внешних интеграций",
  collections: [
    C("profiles", "Профили", [
      F("name", "Название версии резюме"),
      F("resume", "Текст резюме", "textarea"),
    ]),
    C("vacancies", "Вакансии", [
      F("title", "Должность"),
      F("company", "Компания"),
      F("url", "Официальная ссылка", "url"),
      F("requirements", "Требования, по одному на строку", "textarea"),
    ]),
    C("comparisons", "Разборы", [
      R("profile", "Резюме", "profiles"),
      R("vacancy", "Вакансия", "vacancies"),
      F("note", "Проверка человеком", "textarea", { required: false }),
    ]),
  ],
  validate(state, before, command, actor) {
    unique(live(state, "vacancies"), "url", "Ссылка вакансии");
    for (const c of live(state, "comparisons")) {
      byId(state, "profiles", c.profile);
      byId(state, "vacancies", c.vacancy);
    }
    for (const v of live(state, "vacancies"))
      required(
        v.requirements.split(String.fromCharCode(10)).filter((x) => x.trim())
          .length <= 100,
        "Не более 100 явных требований.",
      );
  },
  summarize(state) {
    return live(state, "comparisons").map((c) => {
      const p = byId(state, "profiles", c.profile),
        v = byId(state, "vacancies", c.vacancy),
        text = p.resume.normalize("NFKC").toLocaleLowerCase();
      return summary(
        v.title + " · " + p.name,
        ...v.requirements
          .split(String.fromCharCode(10))
          .filter((x) => x.trim())
          .map(
            (x) =>
              (text.includes(x.trim().normalize("NFKC").toLocaleLowerCase())
                ? "Найдена буквальная формулировка: "
                : "Нет буквальной формулировки: ") + x,
          ),
        "Это текстовый разбор. Он не подтверждает навык, пригодность, ATS-балл или вероятность найма.",
      );
    });
  },
};
export default definition;
