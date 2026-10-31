import type { Block, Inline } from "../lib/markdown";
import { plainText } from "../lib/markdown";

// Renders the parsed document as ordinary elements: nothing from the source becomes raw HTML.
function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        switch (node.kind) {
          case "text":
            return node.text;
          case "code":
            return <code key={index}>{node.text}</code>;
          case "strong":
            return (
              <strong key={index}>
                <Inlines nodes={node.children} />
              </strong>
            );
          case "link":
            return (
              <a
                key={index}
                href={node.href}
                {...(node.external
                  ? { target: "_blank", rel: "noreferrer" }
                  : {})}
              >
                <Inlines nodes={node.children} />
              </a>
            );
        }
      })}
    </>
  );
}

export function Markdown({
  blocks,
  className,
}: {
  blocks: Block[];
  className?: string;
}) {
  return (
    <div className={className}>
      {blocks.map((block, index) => {
        switch (block.kind) {
          case "heading": {
            const Tag = `h${block.level}` as "h1" | "h2" | "h3";
            return (
              <Tag key={index} id={block.id}>
                <Inlines nodes={block.children} />
              </Tag>
            );
          }
          case "paragraph":
            return (
              <p key={index}>
                <Inlines nodes={block.children} />
              </p>
            );
          case "list": {
            const Tag = block.ordered ? "ol" : "ul";
            return (
              <Tag key={index}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <Inlines nodes={item} />
                  </li>
                ))}
              </Tag>
            );
          }
          case "table":
            return (
              // Wide tables and commands scroll sideways, so each is a focusable, named region.
              <div
                key={index}
                className="table-scroll"
                role="region"
                tabIndex={0}
                aria-label={block.header.map(plainText).join(", ")}
              >
                <table>
                  <thead>
                    <tr>
                      {block.header.map((cell, cellIndex) => (
                        <th key={cellIndex} scope="col">
                          <Inlines nodes={cell} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex}>
                            <Inlines nodes={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "code":
            return (
              <pre
                key={index}
                data-language={block.language || undefined}
                role="region"
                tabIndex={0}
                aria-label={block.language || "code"}
              >
                <code>{block.text}</code>
              </pre>
            );
        }
      })}
    </div>
  );
}
