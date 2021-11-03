# api-display-google-sheet
This is a serverless node.js application that will read a google sheet and then create an API

run 'npm install' inside the repo to install dependencies

As part of the installation process you need to get authorization to use the Google Sheets API for the Google Sheet you are using (https://developers.google.com/sheets/api/quickstart/nodejs?authuser=1)

As an example, the Google sheet has certain permissions. You can make sure that the Google sheet lists your gmail account as having editor permissions. Then when you create a OAuth 2.0 Desktop client in the Google Cloud under your gmail account, you will then have access to that Google sheet.

useful blog post: https://www.serverless.com/blog/serverless-express-rest-api