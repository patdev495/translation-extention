# SQLite for the initial Learning Library deployment

The public Learning Library at `learning.peebot.shop` will initially use the existing SQLite backend, with its database stored outside the container and backed up daily on the VPS. PostgreSQL would support a larger concurrent workload and stronger operational tooling, but migrating before the first release would add complexity to an application already built and tested with SQLite. If usage outgrows this setup, migrate the database and preserve account, session, and library data.
