/* Local preview only.
   index.html loads this on localhost / 127.0.0.1 / ::1 and never initialises Firebase.
   Production does not request this file. Firebase Hosting ignores dev/.
   cv.summary is the v3 About text, for layout review only. Elly pastes it into
   Firestore after merge. Blog is empty, matching live public/blog. */
window.MOCK_DATA = {
  cv: {
    tagline: "Economist · Researcher & Data Analyst",
    summary: "I'm an economist and data analyst in Helsinki. I completed the Research Track of the Master's Programme in Economics at the University of Helsinki in May 2026. My thesis, supervised by Professor Mika Meitz, compared GARCH-family models with Random Forest regression for forecasting Bitcoin volatility, and tested whether Google Trends search interest adds predictive power. It largely doesn't: a Gaussian GARCH(1,1) was the benchmark that no competitor significantly beat.\n\nMost of my recent work has been hands-on data work on CHARM, a University of Helsinki Faculty of Theology project on Finland's oldest written culture. I joined the project as a Research Trainee in autumn 2025. As a Research Assistant from February to April 2026, I cleaned and structured high-dimensional spectral data from medieval manuscript fragments and built reproducible R and Python pipelines for clustering and similarity analysis. I have been a Research Assistant on CHARM again since August 2026. Before moving to Finland I did empirical research support at the Strathmore Data Analytics Centre in Nairobi, and project and programme coordination at Strathmore University and the Strathmore Educational Trust.\n\nI work in R, Stata and Python, and I'm most interested in labour markets, remittances (especially Kenya's), and the Finnish economy. I'm improving my Finnish (currently A2). I'm open to roles in economic research, policy analysis and data analytics.",
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    recommendations: [],
    languages: []
  },
  portfolio: [],
  blog: []
};
