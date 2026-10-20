import type { CollectionSlug, Payload, UploadCollectionSlug } from "payload";

import {
  convertMarkdownToLexical,
  editorConfigFactory,
  type LexicalRichTextAdapter,
  type lexicalEditor,
} from "@payloadcms/richtext-lexical";
import path from "node:path";

/**
 * Deletes every document in each collection, trashed ones included, in the order given, so a seed
 * can run again.
 * List a collection before the collections its documents refer to. Uploads lose their stored
 * files too.
 */
export const resetCollections = async (payload: Payload, collections: CollectionSlug[]) => {
  for (const collection of collections) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- The order keeps references valid.
    const { docs, errors } = await payload.delete({
      collection,
      where: { id: { exists: true } },
      overrideAccess: true,
      trash: true,
    });
    if (errors.length > 0) {
      throw new Error(`Deleting ${collection} failed: ${errors.map((e) => e.message).join("; ")}`);
    }
    payload.logger.info(`Deleted ${docs.length} ${collection}.`);
  }
};

/**
 * Uploads each file in `alt` from `directory` to an upload collection, with its alt text, and
 * returns each file's document ID. Each upload runs the collection's transformers, such as
 * Cloudflare Images variants.
 */
export const uploadMedia = async <TFile extends string>(
  payload: Payload,
  {
    collection = "media",
    directory,
    alt,
  }: {
    collection?: UploadCollectionSlug;
    directory: string;
    /** Each file name in `directory`, with its alt text. */
    alt: Record<TFile, string>;
  },
) => {
  const ids = new Map<TFile, number | string>();
  for (const file in alt) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Holds one file and its variants in memory at a time.
    const doc = await payload.create({
      collection,
      data: { alt: alt[file] },
      filePath: path.join(directory, file),
      overrideAccess: true,
    });
    ids.set(file, doc.id);
  }
  payload.logger.info(`Uploaded ${ids.size} files to ${collection}.`);
  return (file: TFile) => {
    const id = ids.get(file);
    if (id === undefined) throw new Error(`${file} wasn't uploaded.`);
    return id;
  };
};

type RootEditor = Payload["config"]["editor"];

const isLexical = (editor: RootEditor): editor is RootEditor & LexicalRichTextAdapter =>
  typeof editor === "object" && "editorConfig" in editor;

const rootEditorConfig = ({ editor }: Payload["config"]) => {
  if (!isLexical(editor)) {
    throw new Error(
      "The config's editor isn't Lexical. Pass the field's editor to markdownToLexical().",
    );
  }
  return editor.editorConfig;
};

/**
 * Returns a function that converts Markdown to Lexical rich text for `editor`, or for the
 * config's `editor`. Pass the editor of the field the text goes in when the field has its own,
 * so the conversion keeps only the nodes that field supports.
 */
export const markdownToLexical = (payload: Payload, editor?: ReturnType<typeof lexicalEditor>) => {
  const editorConfig = editor
    ? editorConfigFactory.fromEditor({ config: payload.config, editor })
    : rootEditorConfig(payload.config);
  return (markdown: string) => convertMarkdownToLexical({ editorConfig, markdown });
};
