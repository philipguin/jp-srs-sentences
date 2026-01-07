import type { Job } from "../state/types";

export function WordListPane(props: {
  jobs: Job[];
  selectedJobId: string;
  onSelect: (id: string) => void;
  onNewJob: () => void;
  onDeleteJob: (id: string) => void;
}) {
  const { jobs, selectedJobId, onSelect, onNewJob, onDeleteJob } = props;

  return (
    <div className="paneInner">
      <div className="paneHeader">
        <div className="paneTitle">Word List</div>
        <button className="btn secondary" onClick={onNewJob}>
          + New
        </button>
      </div>

      <div className="paneBody">
        <div className="list">
          {jobs.map((job) => {
            const selected = job.id === selectedJobId;
            const title = job.word.trim() ? job.word.trim() : "(untitled)";
            const defs = job.definitions.length;
            const res = job.results.length;

            return (
              <div
                key={job.id}
                className={"item" + (selected ? " selected" : "")}
                onClick={() => onSelect(job.id)}
                role="button"
                tabIndex={0}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontWeight: 650 }}>{title}</div>
                  <div className="small">
                    defs: {defs} · rows: {res} · {job.status}
                  </div>
                </div>

                <button
                  className="btn danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteJob(job.id);
                  }}
                  title="Delete job"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        {jobs.length === 0 && <div className="muted">No jobs yet.</div>}
      </div>
    </div>
  );
}
