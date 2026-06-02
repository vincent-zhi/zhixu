declare module "adm-zip" {
  class AdmZip {
    constructor(filePath: string | Buffer);
    getEntries(): Array<{ entryName: string }>;
    readAsText(entry: { entryName: string }): string;
  }
  export default AdmZip;
}
