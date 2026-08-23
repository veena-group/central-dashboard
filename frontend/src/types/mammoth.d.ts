// mammoth ships no TypeScript declarations of its own; this covers only the browser API surface
// this app actually uses (docx -> HTML conversion from an ArrayBuffer).
declare module 'mammoth' {
  export interface MammothMessage {
    type: string;
    message: string;
  }

  export interface MammothConvertResult {
    value: string;
    messages: MammothMessage[];
  }

  export function convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<MammothConvertResult>;
}
