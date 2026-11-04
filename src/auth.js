function adminOnly(req,res,next){return req.session?.user?.role==='admin'?next():res.status(403).json({error:'Admin access required.'})}
function studentOnly(req,res,next){return req.session?.user?.role==='student'?next():res.status(401).json({error:'Please sign in.'})}
module.exports={adminOnly,studentOnly};
