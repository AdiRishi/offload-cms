import type { ComponentType } from "react";

type BlockData = { blockType: string; id?: string | null };

/** A component for every block type in `TBlock`, each receiving its own block's fields. */
export type BlockComponents<TBlock extends BlockData> = {
  [TType in TBlock["blockType"]]: ComponentType<Extract<TBlock, { blockType: TType }>>;
};

/**
 * Renders a blocks field's rows in order, each with the component for its `blockType`. Type
 * `components` with the generated block union, such as `NonNullable<Page["layout"]>[number]`,
 * so a new block type fails the build until it has a component.
 */
export const RenderBlocks = <TBlock extends BlockData>({
  blocks,
  components,
}: {
  blocks: readonly TBlock[] | null | undefined;
  components: BlockComponents<TBlock>;
}) =>
  (blocks ?? []).map((block, index) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- A block's blockType selects the component for its own type.
    const Block = components[block.blockType as TBlock["blockType"]] as ComponentType<TBlock>;
    return <Block key={block.id ?? index} {...block} />;
  });
