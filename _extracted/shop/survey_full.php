<?php
require_once 'header.php';
$logo = "img/KJIHC_beta.png";
?>

<div class="container mt-4" style="max-width:800px;">
  <div class="card shadow">
    <div class="card-body">
      <div class="text-center mb-4">
        <img src="<?php echo $logo; ?>" alt="KJIHC Logo" style="max-width:150px;">
        <h3 class="mt-2">KJIHC Parent Feedback Survey</h3>
        <p class="text-muted">Help us improve your experience across the club</p>
      </div>

      <form action="survey_submit.php" method="post">

        <!-- Player Names -->
        <div class="form-group">
          <label><strong>Player Name(s)</strong></label>
          <input type="text" name="player_names" class="form-control" placeholder="Enter your child(ren)'s name(s)" required>
        </div>

        <hr>
        <h5 class="mt-4">🏒 Game Day</h5>

        <div class="form-group">
          <label><strong>Have you volunteered for any match day roles?</strong></label>
          <div class="form-check"><input class="form-check-input" type="checkbox" name="roles[]" value="Time Clock"> <label class="form-check-label">Time Clock</label></div>
          <div class="form-check"><input class="form-check-input" type="checkbox" name="roles[]" value="Gamesheet"> <label class="form-check-label">Gamesheet</label></div>
          <div class="form-check"><input class="form-check-input" type="checkbox" name="roles[]" value="Goal Judge"> <label class="form-check-label">Goal Judge</label></div>
          <div class="form-check"><input class="form-check-input" type="checkbox" name="roles[]" value="Door Attendant"> <label class="form-check-label">Door Attendant</label></div>
          <div class="form-check"><input class="form-check-input" type="checkbox" name="roles[]" value="Music"> <label class="form-check-label">Music</label></div>
        </div>

        <div class="form-group">
          <label><strong>If you haven’t volunteered yet, what are the reasons?</strong></label>
          <textarea name="volunteer_reason" class="form-control" rows="3" placeholder="e.g. Not confident, unsure what’s involved, not available at the right times, etc."></textarea>
        </div>

        <div class="form-group">
          <label><strong>Would you consider volunteering in the future?</strong></label>
          <select name="volunteer_future" class="form-control">
            <option value="">-- Please select --</option>
            <option value="Yes, with some training">Yes, with some training</option>
            <option value="Maybe">Maybe</option>
            <option value="No, not at this time">No, not at this time</option>
          </select>
        </div>

        <div class="form-group">
          <label>How would you describe the organisation of match days?</label>
          <select class="form-control" name="matchday_rating">
            <option value="">-- Please select --</option>
            <option value="Excellent">Excellent</option>
            <option value="Good">Good</option>
            <option value="Needs Improvement">Needs Improvement</option>
          </select>
        </div>

        <hr>
        <h5 class="mt-4">🏟️ Facilities</h5>
        <div class="form-group">
          <label>Do you have any feedback or suggestions about our training or match facilities (i.e the Galleon)?</label>
          <textarea name="facilities_feedback" class="form-control" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label>Would you support fundraising to help improve facilities or the way we delivery our programmes?</label>
          <select name="support_fundraising" class="form-control">
            <option value="">-- Please select --</option>
            <option value="Yes">Yes</option>
            <option value="Maybe">Maybe</option>
            <option value="No">No</option>
          </select>
        </div>

        <hr>
        <h5 class="mt-4">📱 Social Media & Communication</h5>
        <div class="form-group">
          <label>How do you usually keep up to date with club news?</label>
          <input type="text" name="club_news_source" class="form-control" placeholder="e.g. WhatsApp, Facebook, Email">
        </div>
        <div class="form-group">
          <label>How would you rate the club’s communication overall?</label>
          <select class="form-control" name="comm_rating">
            <option value="">-- Please select --</option>
            <option value="Excellent">Excellent</option>
            <option value="Good">Good</option>
            <option value="Needs Improvement">Needs Improvement</option>
          </select>
        </div>
        <div class="form-group">
          <label>Do you have any ideas to improve our communication or social media presence?</label>
          <textarea name="social_feedback" class="form-control" rows="3"></textarea>
        </div>

        <hr>
        <h5 class="mt-4">⚡ Thunder (Senior SNL Team)</h5>
        <div class="form-group">
          <label>Do you attend Thunder games to support our senior team?</label>
          <select class="form-control" name="thunder_attend">
            <option value="">-- Please select --</option>
            <option value="Yes">Yes</option>
            <option value="Occasionally">Occasionally</option>
            <option value="No">No</option>
          </select>
        </div>
        <div class="form-group">
          <label>If not, what are the reasons?</label>
          <textarea name="thunder_reason" class="form-control" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label>Any thoughts on how we could improve the Thunder match day experience?</label>
          <textarea name="thunder_feedback" class="form-control" rows="3"></textarea>
        </div>

        <hr>
        <h5 class="mt-4">💡 General Suggestions</h5>
        <div class="form-group">
          <label>What do you think KJIHC does really well?</label>
          <textarea name="positive_feedback" class="form-control" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label>What’s one thing you’d like to see improved?</label>
          <textarea name="improvement_suggestion" class="form-control" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label>Do you have suggestions for welcoming new players/parents to the club?</label>
          <textarea name="onboarding_ideas" class="form-control" rows="3"></textarea>
        </div>

        <hr>
        <div class="form-group text-center">
          <button type="submit" class="btn btn-success btn-lg mt-3">✅ Submit Feedback</button>
        </div>
      </form>
    </div>
  </div>
</div>
