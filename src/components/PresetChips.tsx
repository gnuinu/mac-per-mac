import type { CatalogItem } from '../domain/types';
import { Glyph } from './pixel/Glyph';
import styles from './PresetChips.module.css';

interface Props {
  items: readonly CatalogItem[];
  activeId: string | null;
  onPick: (item: CatalogItem) => void;
}

/** 인기 항목을 칩으로 노출해 바로 눌러볼 수 있게 한다. */
export function PresetChips({ items, activeId, onPick }: Props) {
  return (
    <div className={styles.wrap} role="group" aria-label="인기 항목">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={styles.chip}
          aria-pressed={item.id === activeId}
          onClick={() => onPick(item)}
        >
          <Glyph item={item} size={12} className={styles.glyph} />
          {item.name}
        </button>
      ))}
    </div>
  );
}
