"use client";

export function CrmSkeleton() {
  return (
    <div className="crm-skeleton-wrapper" style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%", opacity: 0.7 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: 100,
              borderRadius: 14,
              background: "linear-gradient(90deg, #12131A 25%, #1B1C26 50%, #12131A 75%)",
              backgroundSize: "200% 100%",
              animation: "pulse 1.5s infinite",
            }}
          />
        ))}
      </div>
      <div
        style={{
          height: 320,
          borderRadius: 16,
          background: "linear-gradient(90deg, #12131A 25%, #1B1C26 50%, #12131A 75%)",
          backgroundSize: "200% 100%",
          animation: "pulse 1.5s infinite",
        }}
      />
    </div>
  );
}
