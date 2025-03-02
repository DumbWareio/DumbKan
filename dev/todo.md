We are going to breakout @server.js into separate files to make maintanence easier

we're going to work one function at a time
we need to be very aware and not change any function of the site, it should be perfectly mirrored into the separated files

only do one function at at a time, we will test that function, then we'll move onto the next one

when we make the change, add a comment to the section of @server.js stating where we moved it

we want to avoid adding code to @script.js or @server.js, and new or updated functions should be broken out into their own files in the /src folder or /public/src folder to make maintaining this project easier

We should cleanup scripts.js and server.js if a function is updated and is no longer needed in those files

We've already moved auth to @src 

suggest the next function to move 

DO NOT CHANGE ANY FUNCTION OF THE SITE