/* Local preview only.
   index.html loads this on localhost / 127.0.0.1 / ::1 and never initialises Firebase.
   Production does not request this file. Firebase Hosting ignores dev/.
   cv.summary is the summary currently shown on the live homepage, so Home
   (hardcoded) and CV (this field) stay different until Elly pastes the new
   About text after merge. Blog is empty, matching live public/blog. */
window.MOCK_DATA = {
  cv: {
    tagline: "Economist · Researcher & Data Analyst",
    summary: "Economics graduate with a Research Master's degree in Economics from the University of Helsinki, specializing in econometric theory, time series analysis, volatility modelling, and quantitative methods. Experienced in empirical research support, complex data cleaning and structuring, statistical modelling, and reproducible workflows in R, Stata, and Python. Combines strong technical and analytical skills with practical experience in project coordination, administration, mentoring programme management, and stakeholder reporting. Helsinki-based, seeking opportunities in data analytics, economic research, policy analysis, or quantitative roles where rigorous methods and clear communication drive impact.",
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
