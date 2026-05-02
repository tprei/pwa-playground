import type { PlaygroundAppProps } from "../../platform/types";

const reviewItems = [
  { hanzi: "学习", pinyin: "xuexi", meaning: "study" },
  { hanzi: "今天", pinyin: "jintian", meaning: "today" },
  { hanzi: "朋友", pinyin: "pengyou", meaning: "friend" },
];

export default function ZhongwenApp({ site, storage }: PlaygroundAppProps) {
  const streak = storage.get("streak") ?? "3";

  return (
    <main className="app app--zhongwen">
      <header className="app__header">
        <div>
          <p className="eyebrow">/{site.slug}/</p>
          <h1>{site.title}</h1>
        </div>
        <span className="metric">{streak} day streak</span>
      </header>

      <section className="study-panel">
        <div className="study-panel__prompt">
          <span>复习</span>
          <strong>Review queue</strong>
        </div>
        <div className="word-list">
          {reviewItems.map((item) => (
            <article className="word-card" key={item.hanzi}>
              <strong>{item.hanzi}</strong>
              <span>{item.pinyin}</span>
              <small>{item.meaning}</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
