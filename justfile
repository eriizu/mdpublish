build site="bdc":
    npm run build
    node dist/cli.js site build {{ site }}

publish site="bdc":
    npm run build
    node dist/cli.js site publish {{ site }}

deploy site="bdc":
    npm run build
    node dist/cli.js site deploy {{ site }}
