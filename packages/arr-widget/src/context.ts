import { widgetContextSchema, type WidgetContext, type WidgetSelection } from "@allrightsrespected/mcp/widget";

export interface WidgetContextInput {
  toolVersion: string;
  selection?: WidgetSelection;
  contentHash?: string;
  session?: string;
  filePath?: string;
}

export function buildWidgetContext(input: WidgetContextInput): WidgetContext {
  const context = {
    surface: "browser" as const,
    tool: `arr-widget/${input.toolVersion}`,
    file_path: input.filePath ?? window.location.href,
    selection: input.selection,
    content_hash: input.contentHash,
    session: input.session,
  };

  return widgetContextSchema.parse(context);
}
