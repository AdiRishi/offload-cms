import type { CollectionSlug, GlobalSlug, Where, WidgetServerProps } from "payload";

import { Button } from "@payloadcms/ui";
import { formatAdminURL } from "payload/shared";

/**
 * A button in `quickActionsWidget()`. It opens a collection's list, or its create view with
 * `create`; the first document that matches `where`, or the list when none does; a global; or a
 * URL, such as `/` for the site.
 */
export type QuickAction =
  | { label: string; collection: CollectionSlug; create?: boolean }
  | { label: string; collection: CollectionSlug; where: Where }
  | { label: string; global: GlobalSlug }
  | { label: string; url: string; newTab?: boolean };

type QuickActionsProps = WidgetServerProps & {
  title: string;
  description?: string;
  actions: QuickAction[];
};

/** The widget that `quickActionsWidget()` configures. */
export const QuickActions = async ({
  req,
  permissions,
  title,
  description,
  actions,
}: QuickActionsProps) => {
  const adminRoute = req.payload.config.routes.admin;
  const adminURL = (path: `/${string}`) => formatAdminURL({ adminRoute, path });

  // An editor sees only the actions their permissions allow, as the admin's navigation does. The
  // where lookup also needs read access, because Payload throws Forbidden without it.
  const allowed = actions.filter((action) => {
    if ("url" in action) return true;
    if ("global" in action) return permissions.globals?.[action.global]?.read === true;
    const collection = permissions.collections?.[action.collection];
    return "create" in action && action.create
      ? collection?.create === true
      : collection?.read === true;
  });

  const buttons = await Promise.all(
    allowed.map(async (action) => {
      if ("url" in action) {
        return { label: action.label, url: action.url, newTab: action.newTab ?? false };
      }
      if ("global" in action) {
        return { label: action.label, to: adminURL(`/globals/${action.global}`) };
      }
      const list = adminURL(`/collections/${action.collection}`);
      if ("where" in action) {
        const {
          docs: [match],
        } = await req.payload.find({
          collection: action.collection,
          where: action.where,
          limit: 1,
          depth: 0,
          draft: true,
          pagination: false,
          req,
          overrideAccess: false,
        });
        return { label: action.label, to: match ? `${list}/${match.id}` : list };
      }
      return { label: action.label, to: action.create ? `${list}/create` : list };
    }),
  );

  return (
    <section className="card" style={{ display: "grid", gap: "var(--spacer-3, 1rem)" }}>
      <div>
        <h2 style={{ margin: 0 }}>{title}</h2>
        {description && (
          <p
            style={{ margin: "var(--spacer-1, 0.25rem) 0 0", color: "var(--color-text-secondary)" }}
          >
            {description}
          </p>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--spacer-2, 0.5rem)" }}>
        {buttons.map((button) =>
          "url" in button ? (
            <Button
              key={button.label}
              buttonStyle="secondary"
              el="anchor"
              margin={false}
              newTab={button.newTab}
              url={button.url}
            >
              {button.label}
            </Button>
          ) : (
            <Button
              key={button.label}
              buttonStyle="secondary"
              el="link"
              margin={false}
              to={button.to}
            >
              {button.label}
            </Button>
          ),
        )}
      </div>
    </section>
  );
};
